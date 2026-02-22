import asyncio
import random
from concurrent.futures import ThreadPoolExecutor
from utils.image_utils import decode_base64_image
from services.face_service import FaceService


class LivenessService:
    """Service for liveness detection and verification"""
    
    def __init__(self, face_service: FaceService):
        self.face_service = face_service
        self.executor = ThreadPoolExecutor(max_workers=4)
    
    async def verify(self, image_base64: str, expected_direction: str = None) -> dict:
        """
        Verify liveness by checking face direction.
        
        Args:
            image_base64: Base64 encoded image
            expected_direction: Expected face direction (center/left/right)
            
        Returns:
            Dictionary with success, live, confidence, message, direction
        """
        def _process():
            img = decode_base64_image(image_base64)
            
            # Mock mode - always return expected direction for fast demo (15 sec total)
            if self.face_service.use_mock and expected_direction:
                confidence = random.uniform(0.88, 0.98)
                face_size = random.uniform(0.15, 0.30)  # Simulated face size
                return {
                    "success": True,
                    "live": True,
                    "confidence": round(confidence, 3),
                    "direction": expected_direction,
                    "face_size": round(face_size, 3),
                    "message": f"Looking {expected_direction}"
                }
            
            direction_result = self.face_service.detect_direction(img)

            if not direction_result["detected"]:
                return {
                    "success": False,
                    "live": False,
                    "confidence": 0,
                    "direction": "none",
                    "message": "No face detected"
                }

            actual_direction = direction_result["direction"]
            confidence = direction_result["confidence"]
            face_size = direction_result.get("face_size", 0)

            if expected_direction:
                # For CENTER: check face proximity (face_size >= 15% of frame)
                if expected_direction == "center":
                    is_match = face_size >= 0.12  # 12% of frame = close enough
                    if is_match:
                        confidence = min(1.0, 0.8 + face_size)  # Bigger face = higher confidence
                    return {
                        "success": is_match,
                        "live": is_match,
                        "confidence": round(confidence, 3),
                        "direction": "center" if is_match else actual_direction,
                        "face_size": round(face_size, 3),
                        "message": "Face centered" if is_match else f"Move closer (size: {face_size:.1%})"
                    }
                
                # For LEFT/RIGHT: just check direction (fast head turn)
                is_match = actual_direction == expected_direction  # No confidence threshold
                
                return {
                    "success": is_match,
                    "live": is_match,
                    "confidence": 0.9 if is_match else confidence,  # High confidence when matched
                    "direction": actual_direction,
                    "face_size": round(face_size, 3),
                    "message": f"Looking {expected_direction}" if is_match else f"Turn {expected_direction}"
                }

            return {
                "success": True,
                "live": True,
                "confidence": confidence,
                "direction": actual_direction,
                "message": "Live face detected"
            }

        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(self.executor, _process)
