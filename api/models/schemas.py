from pydantic import BaseModel
from typing import Optional


class ImageRequest(BaseModel):
    """Request model for image-based operations"""
    image: str
    user_id: Optional[str] = None
    challenge: Optional[str] = None


class LivenessResponse(BaseModel):
    """Response model for liveness detection"""
    success: bool
    live: bool
    confidence: float
    message: str
    direction: Optional[str] = None


class RegistrationResponse(BaseModel):
    """Response model for face registration"""
    success: bool
    user_id: str
    message: str


class RecognitionResponse(BaseModel):
    """Response model for face recognition"""
    success: bool
    recognized: bool
    user_id: Optional[str] = None
    confidence: Optional[float] = None
    message: str


class GenderAnalysisResponse(BaseModel):
    """Response model for gender analysis"""
    success: bool
    gender: Optional[str]
    confidence: float
    message: str


class HealthResponse(BaseModel):
    """Response model for health check"""
    status: str
    registered_users: int
