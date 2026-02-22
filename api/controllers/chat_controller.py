"""
Chat Controller - Chat rooms and messaging via Supabase
"""

from fastapi import APIRouter, HTTPException, Header, Query
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
import os
from supabase import create_client, Client

router = APIRouter(prefix="/chat", tags=["chat"])

# Initialize Supabase clients
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "")

supabase_admin: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
supabase_anon: Client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)


# ===== Helper Functions =====

def get_user_from_token(authorization: str) -> str:
    """Extract and validate user from Bearer token"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    token = authorization.replace("Bearer ", "")
    response = supabase_anon.auth.get_user(token)
    
    if not response.user:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    return response.user.id


# ===== Request/Response Models =====

class CreateRoomRequest(BaseModel):
    recipient_id: str

class RoomResponse(BaseModel):
    id: str
    initiator_id: str
    recipient_id: str
    last_message_at: Optional[str] = None
    created_at: str
    other_user: Optional[dict] = None

class RoomListResponse(BaseModel):
    success: bool
    rooms: List[RoomResponse]

class CreateRoomResponse(BaseModel):
    success: bool
    room: Optional[RoomResponse] = None
    message: str

class SendMessageRequest(BaseModel):
    conversation_id: str
    content: str

class MessageResponse(BaseModel):
    id: str
    conversation_id: str
    sender_id: str
    content: str
    is_read: bool
    created_at: str
    sender: Optional[dict] = None

class MessageListResponse(BaseModel):
    success: bool
    messages: List[MessageResponse]

class SendMessageResponse(BaseModel):
    success: bool
    message: Optional[MessageResponse] = None
    error: Optional[str] = None


# ===== Room Endpoints =====

@router.get("/rooms", response_model=RoomListResponse)
async def list_rooms(authorization: str = Header(None)):
    """List all chat rooms for the current user"""
    try:
        user_id = get_user_from_token(authorization)
        
        # Get rooms where user is either initiator or recipient
        response = supabase_admin.table("conversations").select("*").or_(
            f"initiator_id.eq.{user_id},recipient_id.eq.{user_id}"
        ).order("last_message_at", desc=True).execute()
        
        rooms = []
        for room in response.data:
            # Get other user's profile
            other_user_id = room["recipient_id"] if room["initiator_id"] == user_id else room["initiator_id"]
            profile_response = supabase_admin.table("profiles").select(
                "id, username, real_name"
            ).eq("id", other_user_id).execute()
            
            other_user = profile_response.data[0] if profile_response.data else None
            
            rooms.append(RoomResponse(
                id=room["id"],
                initiator_id=room["initiator_id"],
                recipient_id=room["recipient_id"],
                last_message_at=room.get("last_message_at"),
                created_at=room["created_at"],
                other_user=other_user
            ))
        
        return RoomListResponse(success=True, rooms=rooms)
        
    except HTTPException:
        raise
    except Exception as err:
        raise HTTPException(status_code=400, detail=str(err))


@router.post("/rooms", response_model=CreateRoomResponse)
async def create_room(request: CreateRoomRequest, authorization: str = Header(None)):
    """Create a new chat room or return existing one"""
    try:
        user_id = get_user_from_token(authorization)
        
        if user_id == request.recipient_id:
            raise HTTPException(status_code=400, detail="Cannot create room with yourself")
        
        # Check if room already exists (either direction)
        existing = supabase_admin.table("conversations").select("*").or_(
            f"and(initiator_id.eq.{user_id},recipient_id.eq.{request.recipient_id}),"
            f"and(initiator_id.eq.{request.recipient_id},recipient_id.eq.{user_id})"
        ).execute()
        
        if existing.data:
            room = existing.data[0]
            return CreateRoomResponse(
                success=True,
                room=RoomResponse(
                    id=room["id"],
                    initiator_id=room["initiator_id"],
                    recipient_id=room["recipient_id"],
                    last_message_at=room.get("last_message_at"),
                    created_at=room["created_at"]
                ),
                message="Room already exists"
            )
        
        # Create new room
        new_room = supabase_admin.table("conversations").insert({
            "initiator_id": user_id,
            "recipient_id": request.recipient_id
        }).execute()
        
        if not new_room.data:
            raise HTTPException(status_code=400, detail="Failed to create room")
        
        room = new_room.data[0]
        return CreateRoomResponse(
            success=True,
            room=RoomResponse(
                id=room["id"],
                initiator_id=room["initiator_id"],
                recipient_id=room["recipient_id"],
                last_message_at=room.get("last_message_at"),
                created_at=room["created_at"]
            ),
            message="Room created successfully"
        )
        
    except HTTPException:
        raise
    except Exception as err:
        raise HTTPException(status_code=400, detail=str(err))


@router.get("/rooms/{room_id}", response_model=CreateRoomResponse)
async def get_room(room_id: str, authorization: str = Header(None)):
    """Get a specific chat room"""
    try:
        user_id = get_user_from_token(authorization)
        
        response = supabase_admin.table("conversations").select("*").eq("id", room_id).execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="Room not found")
        
        room = response.data[0]
        
        # Verify user is participant
        if room["initiator_id"] != user_id and room["recipient_id"] != user_id:
            raise HTTPException(status_code=403, detail="Not authorized to view this room")
        
        # Get other user's profile
        other_user_id = room["recipient_id"] if room["initiator_id"] == user_id else room["initiator_id"]
        profile_response = supabase_admin.table("profiles").select(
            "id, username, real_name"
        ).eq("id", other_user_id).execute()
        
        other_user = profile_response.data[0] if profile_response.data else None
        
        return CreateRoomResponse(
            success=True,
            room=RoomResponse(
                id=room["id"],
                initiator_id=room["initiator_id"],
                recipient_id=room["recipient_id"],
                last_message_at=room.get("last_message_at"),
                created_at=room["created_at"],
                other_user=other_user
            ),
            message="Room found"
        )
        
    except HTTPException:
        raise
    except Exception as err:
        raise HTTPException(status_code=400, detail=str(err))


# ===== Message Endpoints =====

@router.get("/messages/{room_id}", response_model=MessageListResponse)
async def get_messages(
    room_id: str,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    authorization: str = Header(None)
):
    """Get messages for a chat room"""
    try:
        user_id = get_user_from_token(authorization)
        
        # Verify user is participant in this room
        room_response = supabase_admin.table("conversations").select("*").eq("id", room_id).execute()
        
        if not room_response.data:
            raise HTTPException(status_code=404, detail="Room not found")
        
        room = room_response.data[0]
        if room["initiator_id"] != user_id and room["recipient_id"] != user_id:
            raise HTTPException(status_code=403, detail="Not authorized to view messages")
        
        # Get messages
        messages_response = supabase_admin.table("messages").select("*").eq(
            "conversation_id", room_id
        ).order("created_at", desc=False).range(offset, offset + limit - 1).execute()
        
        # Get sender profiles
        sender_ids = list(set([m["sender_id"] for m in messages_response.data]))
        profiles_response = supabase_admin.table("profiles").select(
            "id, username, real_name"
        ).in_("id", sender_ids).execute()
        
        profiles_map = {p["id"]: p for p in profiles_response.data}
        
        messages = []
        for msg in messages_response.data:
            messages.append(MessageResponse(
                id=msg["id"],
                conversation_id=msg["conversation_id"],
                sender_id=msg["sender_id"],
                content=msg["content"],
                is_read=msg["is_read"],
                created_at=msg["created_at"],
                sender=profiles_map.get(msg["sender_id"])
            ))
        
        # Mark messages as read
        supabase_admin.table("messages").update({"is_read": True}).eq(
            "conversation_id", room_id
        ).neq("sender_id", user_id).eq("is_read", False).execute()
        
        return MessageListResponse(success=True, messages=messages)
        
    except HTTPException:
        raise
    except Exception as err:
        raise HTTPException(status_code=400, detail=str(err))


@router.post("/messages", response_model=SendMessageResponse)
async def send_message(request: SendMessageRequest, authorization: str = Header(None)):
    """Send a message in a chat room"""
    try:
        user_id = get_user_from_token(authorization)
        
        if not request.content.strip():
            raise HTTPException(status_code=400, detail="Message content cannot be empty")
        
        # Verify user is participant in this room
        room_response = supabase_admin.table("conversations").select("*").eq(
            "id", request.conversation_id
        ).execute()
        
        if not room_response.data:
            raise HTTPException(status_code=404, detail="Room not found")
        
        room = room_response.data[0]
        if room["initiator_id"] != user_id and room["recipient_id"] != user_id:
            raise HTTPException(status_code=403, detail="Not authorized to send messages")
        
        # Insert message
        message_response = supabase_admin.table("messages").insert({
            "conversation_id": request.conversation_id,
            "sender_id": user_id,
            "content": request.content.strip()
        }).execute()
        
        if not message_response.data:
            raise HTTPException(status_code=400, detail="Failed to send message")
        
        # Update conversation's last_message_at
        supabase_admin.table("conversations").update({
            "last_message_at": datetime.utcnow().isoformat()
        }).eq("id", request.conversation_id).execute()
        
        msg = message_response.data[0]
        
        # Get sender profile
        profile_response = supabase_admin.table("profiles").select(
            "id, username, real_name"
        ).eq("id", user_id).execute()
        
        sender = profile_response.data[0] if profile_response.data else None
        
        return SendMessageResponse(
            success=True,
            message=MessageResponse(
                id=msg["id"],
                conversation_id=msg["conversation_id"],
                sender_id=msg["sender_id"],
                content=msg["content"],
                is_read=msg["is_read"],
                created_at=msg["created_at"],
                sender=sender
            )
        )
        
    except HTTPException:
        raise
    except Exception as err:
        raise HTTPException(status_code=400, detail=str(err))


@router.get("/unread-count")
async def get_unread_count(authorization: str = Header(None)):
    """Get total unread message count for user"""
    try:
        user_id = get_user_from_token(authorization)
        
        # Get all rooms where user is participant
        rooms_response = supabase_admin.table("conversations").select("id").or_(
            f"initiator_id.eq.{user_id},recipient_id.eq.{user_id}"
        ).execute()
        
        if not rooms_response.data:
            return {"success": True, "unread_count": 0}
        
        room_ids = [r["id"] for r in rooms_response.data]
        
        # Count unread messages not sent by user
        count_response = supabase_admin.table("messages").select(
            "id", count="exact"
        ).in_("conversation_id", room_ids).neq("sender_id", user_id).eq("is_read", False).execute()
        
        return {"success": True, "unread_count": count_response.count or 0}
        
    except HTTPException:
        raise
    except Exception as err:
        raise HTTPException(status_code=400, detail=str(err))
