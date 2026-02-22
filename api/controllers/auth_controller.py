

from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel, EmailStr
from typing import List, Optional
import os
from supabase import create_client, Client

router = APIRouter(prefix="/auth", tags=["auth"])

# Initialize Supabase clients
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "")

if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
    raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set")

# Admin client (service role) - for privileged operations
supabase_admin: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
# User client (anon key) - for regular auth
supabase_anon: Client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)


# ===== Request/Response Models =====

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    realName: str
    username: str
    interests: List[str]
    lifeExpectations: str
    whatBroughtYouHere: str
    linkedinLink: Optional[str] = None

class RegisterResponse(BaseModel):
    success: bool
    user_id: Optional[str] = None
    message: str

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class LoginResponse(BaseModel):
    success: bool
    user_id: Optional[str] = None
    access_token: Optional[str] = None
    message: str

class UserResponse(BaseModel):
    id: str
    email: str
    username: Optional[str] = None
    real_name: Optional[str] = None

class SessionResponse(BaseModel):
    authenticated: bool
    user: Optional[UserResponse] = None


# ===== Endpoints =====

@router.post("/register", response_model=RegisterResponse)
async def register(request: RegisterRequest):
    """Register new user with profile"""
    auth_response = None
    try:
        # Create auth user
        auth_response = supabase_admin.auth.sign_up({
            "email": request.email,
            "password": request.password,
        })

        if not auth_response.user:
            raise HTTPException(status_code=400, detail="Auth signup failed")

        user_id = auth_response.user.id
        print(f"[Auth] User created: {user_id}")

        # Create profile
        profile_data = {
            "id": user_id,
            "email": request.email,
            "real_name": request.realName,
            "username": request.username,
            "email_verified": True,
            "interests": request.interests,
            "life_expectations": request.lifeExpectations,
            "what_brought_you_here": request.whatBroughtYouHere,
            "linkedin_link": request.linkedinLink,
            "linkedin_verified": False,
            "is_public_in_recommendations": True,
        }

        supabase_admin.table("profiles").insert(profile_data).execute()
        print(f"[Profile] Created for user: {user_id}")

        return RegisterResponse(
            success=True,
            user_id=user_id,
            message="User registered successfully"
        )

    except Exception as err:
        error_msg = str(err)
        print(f"[Register Error] {error_msg}")
        
        if auth_response and auth_response.user:
            try:
                supabase_admin.auth.admin.delete_user(auth_response.user.id)
            except:
                pass

        raise HTTPException(status_code=400, detail=error_msg)


@router.post("/login", response_model=LoginResponse)
async def login(request: LoginRequest):
    """Login with email/password"""
    try:
        response = supabase_anon.auth.sign_in_with_password({
            "email": request.email,
            "password": request.password,
        })

        if not response.user:
            return LoginResponse(success=False, message="Invalid credentials")

        return LoginResponse(
            success=True,
            user_id=response.user.id,
            access_token=response.session.access_token if response.session else None,
            message="Login successful"
        )

    except Exception as err:
        return LoginResponse(success=False, message=str(err))


@router.post("/logout")
async def logout(authorization: str = Header(None)):
    """Logout user"""
    try:
        if authorization and authorization.startswith("Bearer "):
            token = authorization.replace("Bearer ", "")
            supabase_anon.auth.sign_out(token)
        return {"success": True, "message": "Logged out"}
    except Exception as err:
        return {"success": False, "message": str(err)}


@router.get("/session", response_model=SessionResponse)
async def get_session(authorization: str = Header(None)):
    """Get current session"""
    try:
        if not authorization or not authorization.startswith("Bearer "):
            return SessionResponse(authenticated=False)

        token = authorization.replace("Bearer ", "")
        response = supabase_anon.auth.get_session(token)
        
        if response.session and response.user:
            return SessionResponse(
                authenticated=True,
                user=UserResponse(
                    id=response.user.id,
                    email=response.user.email
                )
            )
        
        return SessionResponse(authenticated=False)
        
    except Exception as err:
        return SessionResponse(authenticated=False)


@router.get("/user", response_model=UserResponse)
async def get_user(authorization: str = Header(None)):
    """Get current user profile data"""
    try:
        if not authorization or not authorization.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="Not authenticated")

        token = authorization.replace("Bearer ", "")
        response = supabase_anon.auth.get_user(token)
        
        if not response.user:
            raise HTTPException(status_code=401, detail="Invalid token")

        user_id = response.user.id
        
        # Get profile data
        profile_response = supabase_admin.table("profiles").select("*").eq("id", user_id).execute()
        
        if profile_response.data and len(profile_response.data) > 0:
            profile = profile_response.data[0]
            return UserResponse(
                id=user_id,
                email=response.user.email,
                username=profile.get("username"),
                real_name=profile.get("real_name")
            )
        
        return UserResponse(id=user_id, email=response.user.email)
        
    except HTTPException:
        raise
    except Exception as err:
        raise HTTPException(status_code=400, detail=str(err))
