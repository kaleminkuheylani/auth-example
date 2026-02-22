import cv2
import numpy as np
import base64


def decode_base64_image(base64_string: str) -> np.ndarray:
    """
    Decode a base64 encoded image string to numpy array.
    
    Args:
        base64_string: Base64 encoded image (with or without data URI prefix)
        
    Returns:
        OpenCV image as numpy array (BGR format)
        
    Raises:
        ValueError: If image is empty or decoding fails
    """
    # Remove data URI prefix if present
    if "," in base64_string:
        base64_string = base64_string.split(",")[-1]

    base64_string = base64_string.strip()

    # Decode base64 to bytes
    img_data = base64.b64decode(base64_string)
    if len(img_data) == 0:
        raise ValueError("Empty image data")

    # Convert to numpy array and decode as image
    img_array = cv2.imdecode(
        np.frombuffer(img_data, np.uint8),
        cv2.IMREAD_COLOR
    )

    if img_array is None:
        raise ValueError("Failed to decode image")

    return img_array
