import numpy as np

# Try to import DeepFace
try:
    from deepface import DeepFace
    DEEPFACE_AVAILABLE = True
except ImportError:
    DEEPFACE_AVAILABLE = False


class GenderService:
    """Service for gender detection using DeepFace"""
    
    def __init__(self):
        self.deepface_available = DEEPFACE_AVAILABLE
    
    def analyze(self, img: np.ndarray) -> dict:
        """
        Analyze gender from face image.
        
        Args:
            img: OpenCV image (BGR format)
            
        Returns:
            Dictionary with gender, confidence, success
        """
        if not self.deepface_available:
            # Return mock response when DeepFace not available
            return {
                "success": True,
                "gender": "male",
                "confidence": 0.9,
                "message": "Mock gender (DeepFace not available)"
            }

        try:
            analysis = DeepFace.analyze(
                img_path=img,
                actions=['gender'],
                enforce_detection=True,
                detector_backend='opencv',
                silent=True
            )

            gender_result = analysis[0]['gender']

            if gender_result['Man'] > gender_result['Woman']:
                gender = "male"
                confidence = gender_result['Man'] / 100
            else:
                gender = "female"
                confidence = gender_result['Woman'] / 100

            return {
                "success": True,
                "gender": gender,
                "confidence": confidence,
                "message": "Gender detected successfully"
            }

        except Exception as e:
            return {
                "success": False,
                "gender": None,
                "confidence": 0,
                "message": f"Gender analysis failed: {str(e)}"
            }
