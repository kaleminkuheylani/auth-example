from fastapi import APIRouter, HTTPException
from models import (
    ImageRequest,
    LivenessResponse,
    RegistrationResponse,
    RecognitionResponse,
    GenderAnalysisResponse
)
#from services import FaceService, LivenessService, GenderService
#from utils import decode_base64_image
import os
import tempfile

router = APIRouter(prefix="/api", tags=["Face Authentication"])

# Initialize services
FACE_DB_DIR = os.path.join(tempfile.gettempdir(), "face_db")
#face_service = FaceService(FACE_DB_DIR)
#liveness_service = LivenessService(face_service)
#gender_service = GenderService()


@router.post("/liveness", response_model=LivenessResponse)
async def check_liveness(request: ImageRequest):
    """
    Check if the face in the image is live and facing the expected direction.
    """
    result = await liveness_service.verify(request.image, request.challenge)
    
    return LivenessResponse(
        success=result["success"],
        live=result["live"],
        confidence=result["confidence"],
        direction=result["direction"],
        message=result["message"]
    )


@router.post("/register", response_model=RegistrationResponse)
async def register_face(request: ImageRequest):
    """
    Register a new face for a user.
    """
    if not request.user_id:
        raise HTTPException(status_code=400, detail="user_id is required")

    try:
        img = decode_base64_image(request.image)
        result = face_service.register_face(request.user_id, img)
        
        if result["success"]:
            return RegistrationResponse(
                success=True,
                user_id=request.user_id,
                message=result["message"]
            )
        else:
            raise HTTPException(status_code=500, detail=result["message"])
            
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/recognize", response_model=RecognitionResponse)
async def recognize_face(request: ImageRequest):
    """
    Recognize a face and return the matching user.
    """
    try:
        img = decode_base64_image(request.image)
        result = face_service.find_face(img)
        
        if result["found"]:
            return RecognitionResponse(
                success=True,
                recognized=True,
                user_id=result["user_id"],
                confidence=result["confidence"],
                message="Face recognized"
            )
        else:
            return RecognitionResponse(
                success=True,
                recognized=False,
                message="No matching face found"
            )
            
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/analyze-gender", response_model=GenderAnalysisResponse)
async def analyze_gender(request: ImageRequest):
    """
    Analyze gender from face image using DeepFace.
    """
    try:
        img = decode_base64_image(request.image)
        result = gender_service.analyze(img)
        
        return GenderAnalysisResponse(
            success=result["success"],
            gender=result["gender"],
            confidence=result["confidence"],
            message=result["message"]
        )
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/health")
async def health_check():
    """
    Health check endpoint with registered user count.
    """
    return {
        "status": "healthy",
        "registered_users": face_service.get_registered_count()
    }
