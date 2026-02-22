from fastapi import APIRouter
from pydantic import BaseModel
import random
import string
from datetime import datetime, timedelta

router = APIRouter(prefix="/api/email", tags=["email"])

# In-memory storage for verification codes (demo only)
verification_codes = {}

class SendCodeRequest(BaseModel):
    email: str

class VerifyCodeRequest(BaseModel):
    email: str
    code: str

def generate_code(length=6):
    return ''.join(random.choices(string.digits, k=length))

@router.post("/send-code")
async def send_verification_code(request: SendCodeRequest):
    """Send verification code to email (demo: returns code in response)"""
    code = generate_code()
    
    # Store code with expiration (5 minutes)
    verification_codes[request.email] = {
        "code": code,
        "expires": datetime.now() + timedelta(minutes=5)
    }
    
    # In production: send actual email here
    # For demo: return code in response
    return {
        "success": True,
        "message": "Verification code sent",
        "code": code  # Remove in production!
    }

@router.post("/verify")
async def verify_email_code(request: VerifyCodeRequest):
    """Verify the email code"""
    stored = verification_codes.get(request.email)
    
    if not stored:
        return {"success": False, "message": "No code found. Please request a new one."}
    
    if datetime.now() > stored["expires"]:
        del verification_codes[request.email]
        return {"success": False, "message": "Code expired. Please request a new one."}
    
    if stored["code"] != request.code:
        return {"success": False, "message": "Invalid code"}
    
    # Code verified - remove from storage
    del verification_codes[request.email]
    
    return {
        "success": True,
        "message": "Email verified successfully"
    }
