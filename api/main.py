from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
import cv2
import numpy as np
import base64
import os
import tempfile
from io import BytesIO
from PIL import Image
import asyncio
from concurrent.futures import ThreadPoolExecutor
import hashlib
import time

# Try to import DeepFace, fallback to mock if not available
try:
    from deepface import DeepFace
    DEEPFACE_AVAILABLE = True
except ImportError:
    DEEPFACE_AVAILABLE = False
    print("Warning: DeepFace not available, using mock implementation")

app = FastAPI(
    title="Face Auth API",
    description="Live detection + Face recognition using DeepFace",
    version="1.0.0"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Thread pool for CPU-intensive tasks
executor = ThreadPoolExecutor(max_workers=4)

# Face database directory
FACE_DB_DIR = os.path.join(tempfile.gettempdir(), "face_db")
os.makedirs(FACE_DB_DIR, exist_ok=True)

# Pydantic models
class ImageRequest(BaseModel):
    image: str  # base64 encoded
    user_id: Optional[str] = None
    challenge: Optional[str] = "blink"

class RecognitionResponse(BaseModel):
    success: bool
    recognized: bool
    user_id: Optional[str] = None
    confidence: Optional[float] = None
    message: str

class LivenessResponse(BaseModel):
    success: bool
    live: bool
    confidence: float
    message: str

class RegistrationResponse(BaseModel):
    success: bool
    user_id: str
    message: str

def decode_base64_image(base64_string: str) -> np.ndarray:
    """Decode base64 image to numpy array"""
    try:
        if not base64_string or not isinstance(base64_string, str):
            raise ValueError("Invalid input: base64_string must be a non-empty string")
        
        # Handle data URI format (data:image/jpeg;base64,...)
        if "," in base64_string:
            parts = base64_string.split(",")
            if len(parts) >= 2:
                base64_string = parts[-1]  # Take the last part after comma
        
        # Remove any whitespace and newlines
        base64_string = base64_string.strip().replace('\n', '').replace('\r', '')
        
        # Add padding if needed
        padding_needed = len(base64_string) % 4
        if padding_needed:
            base64_string += '=' * (4 - padding_needed)
        
        # Decode base64
        try:
            img_data = base64.b64decode(base64_string, validate=True)
        except Exception as decode_err:
            raise ValueError(f"Base64 decode failed: {str(decode_err)}")
        
        if len(img_data) == 0:
            raise ValueError("Decoded image data is empty")
        
        # Try OpenCV first (more robust for various formats)
        img_array = cv2.imdecode(np.frombuffer(img_data, np.uint8), cv2.IMREAD_COLOR)
        
        if img_array is None:
            # Fallback to PIL if OpenCV fails
            try:
                img = Image.open(BytesIO(img_data))
                # Convert to RGB first
                if img.mode != 'RGB':
                    img = img.convert('RGB')
                img_array = np.array(img)
                # Convert RGB to BGR for OpenCV
                img_array = cv2.cvtColor(img_array, cv2.COLOR_RGB2BGR)
            except Exception as pil_err:
                raise ValueError(f"PIL decode failed: {str(pil_err)}")
        
        if img_array is None or img_array.size == 0:
            raise ValueError("Failed to decode image: empty result")
            
        return img_array
    except Exception as e:
        print(f"[ERROR] Failed to decode image: {e}")
        print(f"[ERROR] Input length: {len(base64_string) if isinstance(base64_string, str) else 'N/A'}")
        print(f"[ERROR] Input preview: {base64_string[:200] if isinstance(base64_string, str) else 'N/A'}...")
        raise

def encode_image_to_base64(img: np.ndarray) -> str:
    """Encode numpy array to base64"""
    _, buffer = cv2.imencode('.jpg', img)
    return base64.b64encode(buffer).decode('utf-8')

def detect_face_opencv(img: np.ndarray) -> tuple:
    """Basic face detection using OpenCV as fallback"""
    face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    faces = face_cascade.detectMultiScale(gray, 1.1, 4)
    return len(faces) > 0, faces

def detect_face_direction(img: np.ndarray) -> dict:
    """Detect if face is looking left, right, or center using facial landmarks"""
    try:
        face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        faces = face_cascade.detectMultiScale(gray, 1.1, 5)
        
        if len(faces) == 0:
            return {"detected": False, "direction": "none", "confidence": 0}
        
        (x, y, w, h) = faces[0]
        face_center_x = x + w // 2
        face_center_y = y + h // 2
        
        # Use eye detection for better direction analysis
        eye_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_eye.xml')
        roi_gray = gray[y:y+h, x:x+w]
        eyes = eye_cascade.detectMultiScale(roi_gray)
        
        if len(eyes) >= 2:
            # Sort eyes by x position
            eyes = sorted(eyes, key=lambda e: e[0])
            left_eye = eyes[0]
            right_eye = eyes[-1]
            
            # Calculate eye centers relative to face
            left_eye_center = (x + left_eye[0] + left_eye[2]//2, y + left_eye[1] + left_eye[3]//2)
            right_eye_center = (x + right_eye[0] + right_eye[2]//2, y + right_eye[1] + right_eye[3]//2)
            
            # Calculate face asymmetry to determine direction
            face_width = w
            left_dist = left_eye_center[0] - x
            right_dist = (x + w) - right_eye_center[0]
            
            # If left side is larger, looking right (more of left side visible)
            # If right side is larger, looking left (more of right side visible)
            asymmetry = (left_dist - right_dist) / face_width
            
            if asymmetry > 0.15:
                return {"detected": True, "direction": "right", "confidence": min(abs(asymmetry) * 2, 1.0), "asymmetry": asymmetry}
            elif asymmetry < -0.15:
                return {"detected": True, "direction": "left", "confidence": min(abs(asymmetry) * 2, 1.0), "asymmetry": asymmetry}
            else:
                return {"detected": True, "direction": "center", "confidence": 1.0 - abs(asymmetry), "asymmetry": asymmetry}
        
        return {"detected": True, "direction": "center", "confidence": 0.5, "asymmetry": 0}
        
    except Exception as e:
        return {"detected": False, "direction": "none", "confidence": 0, "error": str(e)}

async def verify_liveness_deepface(image_base64: str, expected_direction: str = None) -> dict:
    """Verify if face is live using DeepFace with directional challenge"""
    if not DEEPFACE_AVAILABLE:
        # Mock implementation with direction support
        await asyncio.sleep(0.3)
        
        if expected_direction:
            # Mock: randomly succeed or ask for retry
            import random
            success = random.random() > 0.3  # 70% success rate for demo
            return {
                "success": success,
                "live": success,
                "confidence": 0.85 if success else 0.3,
                "message": f"Looking {expected_direction} verified!" if success else f"Please look {expected_direction}",
                "direction": expected_direction if success else "center"
            }
        
        return {
            "success": True,
            "live": True,
            "confidence": 0.95,
            "message": "Live face detected (mock)"
        }
    
    def _verify():
        try:
            img = decode_base64_image(image_base64)
            
            # Check face direction if challenge provided
            if expected_direction:
                direction_result = detect_face_direction(img)
                
                if not direction_result["detected"]:
                    return {
                        "success": False,
                        "live": False,
                        "confidence": 0,
                        "message": "No face detected",
                        "direction": "none"
                    }
                
                # Check if user is looking in expected direction
                is_correct_direction = direction_result["direction"] == expected_direction
                
                return {
                    "success": is_correct_direction,
                    "live": is_correct_direction,
                    "confidence": direction_result["confidence"],
                    "message": f"Looking {expected_direction}!" if is_correct_direction else f"Please look {expected_direction}",
                    "direction": direction_result["direction"],
                    "expected": expected_direction
                }
            
            # Basic liveness check
            analysis = DeepFace.analyze(
                img_path=img,
                actions=['emotion'],
                enforce_detection=True,
                detector_backend='opencv',
                silent=True
            )
            
            if len(analysis) == 0:
                return {
                    "success": False,
                    "live": False,
                    "confidence": 0,
                    "message": "No face detected"
                }
            
            face_conf = analysis[0].get('face_confidence', 0.5)
            is_live = face_conf > 0.7
            
            return {
                "success": True,
                "live": is_live,
                "confidence": face_conf,
                "message": "Live face detected" if is_live else "Face detection uncertain"
            }
            
        except Exception as e:
            return {
                "success": False,
                "live": False,
                "confidence": 0,
                "message": f"Detection failed: {str(e)}"
            }
    
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(executor, _verify)

async def register_face_deepface(image_base64: str, user_id: str) -> dict:
    """Register face embedding for user"""
    if not DEEPFACE_AVAILABLE:
        await asyncio.sleep(0.5)
        return {
            "success": True,
            "user_id": user_id,
            "message": "Face registered (mock)"
        }
    
    def _register():
        try:
            img = decode_base64_image(image_base64)
            
            # Save reference image
            user_face_path = os.path.join(FACE_DB_DIR, f"{user_id}.jpg")
            cv2.imwrite(user_face_path, img)
            
            # Generate embedding
            embedding = DeepFace.represent(
                img_path=img,
                model_name="Facenet",
                enforce_detection=True,
                detector_backend='opencv',
                silent=True
            )
            
            # Save embedding
            embedding_path = os.path.join(FACE_DB_DIR, f"{user_id}_embedding.npy")
            np.save(embedding_path, embedding[0]['embedding'])
            
            return {
                "success": True,
                "user_id": user_id,
                "message": "Face registered successfully"
            }
            
        except Exception as e:
            return {
                "success": False,
                "user_id": user_id,
                "message": f"Registration failed: {str(e)}"
            }
    
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(executor, _register)

async def recognize_face_deepface(image_base64: str) -> dict:
    """Recognize face against registered users"""
    if not DEEPFACE_AVAILABLE:
        await asyncio.sleep(0.5)
        return {
            "success": True,
            "recognized": True,
            "user_id": "mock_user_123",
            "confidence": 0.92,
            "message": "User recognized (mock)"
        }
    
    def _recognize():
        try:
            img = decode_base64_image(image_base64)
            
            # Save temp image
            temp_path = os.path.join(tempfile.gettempdir(), f"temp_{int(time.time())}.jpg")
            cv2.imwrite(temp_path, img)
            
            results = []
            
            # Compare with all registered faces
            for filename in os.listdir(FACE_DB_DIR):
                if filename.endswith('.jpg'):
                    user_id = filename.replace('.jpg', '')
                    reference_path = os.path.join(FACE_DB_DIR, filename)
                    
                    try:
                        result = DeepFace.verify(
                            img1_path=temp_path,
                            img2_path=reference_path,
                            model_name="Facenet",
                            detector_backend='opencv',
                            distance_metric='cosine',
                            silent=True
                        )
                        
                        if result['verified']:
                            confidence = 1 - result['distance']
                            results.append({
                                'user_id': user_id,
                                'confidence': confidence,
                                'distance': result['distance']
                            })
                    except:
                        continue
            
            # Cleanup
            if os.path.exists(temp_path):
                os.remove(temp_path)
            
            if results:
                results.sort(key=lambda x: x['confidence'], reverse=True)
                best = results[0]
                
                return {
                    "success": True,
                    "recognized": True,
                    "user_id": best['user_id'],
                    "confidence": best['confidence'],
                    "message": f"Recognized with {best['confidence']:.1%} confidence"
                }
            else:
                return {
                    "success": True,
                    "recognized": False,
                    "message": "No matching face found"
                }
                
        except Exception as e:
            return {
                "success": False,
                "recognized": False,
                "message": f"Recognition failed: {str(e)}"
            }
    
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(executor, _recognize)

# API Endpoints
@app.get("/")
async def root():
    return {
        "service": "Face Auth API",
        "version": "1.0.0",
        "deepface_available": DEEPFACE_AVAILABLE,
        "endpoints": [
            "/api/liveness",
            "/api/register",
            "/api/recognize"
        ]
    }

@app.post("/api/liveness", response_model=LivenessResponse)
async def check_liveness(request: ImageRequest):
    """
    Step 1: Verify liveness - check if face is real
    Supports directional challenges: 'left', 'right', 'center'
    """
    result = await verify_liveness_deepface(request.image, request.challenge)
    return LivenessResponse(**result)

@app.post("/api/register", response_model=RegistrationResponse)
async def register(request: ImageRequest):
    """
    Step 2: Register face after liveness check
    """
    if not request.user_id:
        raise HTTPException(status_code=400, detail="user_id required")
    
    result = await register_face_deepface(request.image, request.user_id)
    
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["message"])
    
    return RegistrationResponse(**result)

@app.post("/api/recognize", response_model=RecognitionResponse)
async def recognize(request: ImageRequest):
    """
    Step 3: Recognize who the person is
    """
    result = await recognize_face_deepface(request.image)
    return RecognitionResponse(**result)

@app.get("/api/health")
async def health_check():
    return {
        "status": "healthy",
        "deepface": DEEPFACE_AVAILABLE,
        "registered_users": len([f for f in os.listdir(FACE_DB_DIR) if f.endswith('.jpg')])
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5000)
