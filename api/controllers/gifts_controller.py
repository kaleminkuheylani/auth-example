"""
Gifts Controller - Gift/Balance system via Supabase
"""

from fastapi import APIRouter, HTTPException, Header, Query
from pydantic import BaseModel
from typing import List, Optional
from decimal import Decimal
import os
from supabase import create_client, Client

router = APIRouter(prefix="/gifts", tags=["gifts"])

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

class GiftPackageResponse(BaseModel):
    id: str
    amount: int
    name: str
    description: Optional[str] = None
    commission_rate: float
    is_active: bool

class PackagesListResponse(BaseModel):
    success: bool
    packages: List[GiftPackageResponse]

class BalanceResponse(BaseModel):
    success: bool
    balance: float
    total_received: float
    total_sent: float

class SendGiftRequest(BaseModel):
    to_user_id: str
    package_id: str

class SendGiftResponse(BaseModel):
    success: bool
    message: str
    gift_id: Optional[str] = None
    amount: Optional[int] = None
    receiver_amount: Optional[float] = None

class GiftHistoryItem(BaseModel):
    id: str
    from_user_id: str
    to_user_id: str
    amount: int
    commission_amount: float
    receiver_amount: float
    status: str
    created_at: str
    from_user: Optional[dict] = None
    to_user: Optional[dict] = None
    package: Optional[dict] = None

class GiftHistoryResponse(BaseModel):
    success: bool
    gifts: List[GiftHistoryItem]
    total_count: int


# ===== Endpoints =====

@router.get("/packages", response_model=PackagesListResponse)
async def list_packages():
    """List all available gift packages"""
    try:
        response = supabase_admin.table("gift_packages").select("*").eq(
            "is_active", True
        ).order("amount").execute()
        
        packages = [
            GiftPackageResponse(
                id=p["id"],
                amount=p["amount"],
                name=p["name"],
                description=p.get("description"),
                commission_rate=float(p.get("commission_rate", 0.20)),
                is_active=p["is_active"]
            )
            for p in response.data
        ]
        
        return PackagesListResponse(success=True, packages=packages)
        
    except Exception as err:
        raise HTTPException(status_code=400, detail=str(err))


@router.get("/balance", response_model=BalanceResponse)
async def get_balance(authorization: str = Header(None)):
    """Get current user's balance"""
    try:
        user_id = get_user_from_token(authorization)
        
        response = supabase_admin.table("user_balances").select("*").eq(
            "user_id", user_id
        ).execute()
        
        if response.data:
            balance_data = response.data[0]
            return BalanceResponse(
                success=True,
                balance=float(balance_data.get("balance", 0)),
                total_received=float(balance_data.get("total_received", 0)),
                total_sent=float(balance_data.get("total_sent", 0))
            )
        
        # No balance record yet - create one
        supabase_admin.table("user_balances").insert({
            "user_id": user_id,
            "balance": 0,
            "total_received": 0,
            "total_sent": 0
        }).execute()
        
        return BalanceResponse(
            success=True,
            balance=0.0,
            total_received=0.0,
            total_sent=0.0
        )
        
    except HTTPException:
        raise
    except Exception as err:
        raise HTTPException(status_code=400, detail=str(err))


@router.post("/send", response_model=SendGiftResponse)
async def send_gift(request: SendGiftRequest, authorization: str = Header(None)):
    """Send a gift to another user"""
    try:
        user_id = get_user_from_token(authorization)
        
        # Cannot send to self
        if user_id == request.to_user_id:
            raise HTTPException(status_code=400, detail="Cannot send gift to yourself")
        
        # Verify recipient exists
        recipient_response = supabase_admin.table("profiles").select("id").eq(
            "id", request.to_user_id
        ).execute()
        
        if not recipient_response.data:
            raise HTTPException(status_code=404, detail="Recipient not found")
        
        # Get gift package
        package_response = supabase_admin.table("gift_packages").select("*").eq(
            "id", request.package_id
        ).eq("is_active", True).execute()
        
        if not package_response.data:
            raise HTTPException(status_code=404, detail="Gift package not found")
        
        package = package_response.data[0]
        gift_amount = package["amount"]
        
        # Check sender's balance
        balance_response = supabase_admin.table("user_balances").select("*").eq(
            "user_id", user_id
        ).execute()
        
        sender_balance = 0
        if balance_response.data:
            sender_balance = float(balance_response.data[0].get("balance", 0))
        
        if sender_balance < gift_amount:
            raise HTTPException(
                status_code=400, 
                detail=f"Insufficient balance. You have {sender_balance} coins but need {gift_amount}"
            )
        
        # Deduct from sender's balance
        new_sender_balance = sender_balance - gift_amount
        supabase_admin.table("user_balances").upsert({
            "user_id": user_id,
            "balance": new_sender_balance,
            "total_sent": supabase_admin.table("user_balances").select("total_sent").eq(
                "user_id", user_id
            ).execute().data[0].get("total_sent", 0) + gift_amount if balance_response.data else gift_amount
        }).execute()
        
        # Create gift record (trigger will handle receiver balance update)
        gift_response = supabase_admin.table("gifts").insert({
            "from_user_id": user_id,
            "to_user_id": request.to_user_id,
            "package_id": request.package_id,
            "amount": gift_amount
        }).execute()
        
        if not gift_response.data:
            # Rollback sender balance
            supabase_admin.table("user_balances").update({
                "balance": sender_balance
            }).eq("user_id", user_id).execute()
            raise HTTPException(status_code=400, detail="Failed to send gift")
        
        gift = gift_response.data[0]
        
        # Update sender's profile gift count
        supabase_admin.table("profiles").update({
            "total_gifts_sent": supabase_admin.rpc("increment_gift_sent", {"user_id_param": user_id}).execute()
        }).eq("id", user_id).execute()
        
        # Update receiver's profile gift count
        supabase_admin.table("profiles").update({
            "total_gifts_received": supabase_admin.rpc("increment_gift_received", {"user_id_param": request.to_user_id}).execute()
        }).eq("id", request.to_user_id).execute()
        
        return SendGiftResponse(
            success=True,
            message="Gift sent successfully!",
            gift_id=gift["id"],
            amount=gift_amount,
            receiver_amount=float(gift.get("receiver_amount", 0))
        )
        
    except HTTPException:
        raise
    except Exception as err:
        print(f"[Gift Error] {str(err)}")
        raise HTTPException(status_code=400, detail=str(err))


@router.get("/history", response_model=GiftHistoryResponse)
async def get_gift_history(
    type: str = Query("all", regex="^(sent|received|all)$"),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    authorization: str = Header(None)
):
    """Get gift transaction history"""
    try:
        user_id = get_user_from_token(authorization)
        
        # Build query based on type
        query = supabase_admin.table("gifts").select("*", count="exact")
        
        if type == "sent":
            query = query.eq("from_user_id", user_id)
        elif type == "received":
            query = query.eq("to_user_id", user_id)
        else:
            query = query.or_(f"from_user_id.eq.{user_id},to_user_id.eq.{user_id}")
        
        response = query.order("created_at", desc=True).range(
            offset, offset + limit - 1
        ).execute()
        
        # Get user profiles and packages
        user_ids = set()
        package_ids = set()
        for gift in response.data:
            user_ids.add(gift["from_user_id"])
            user_ids.add(gift["to_user_id"])
            if gift.get("package_id"):
                package_ids.add(gift["package_id"])
        
        profiles_response = supabase_admin.table("profiles").select(
            "id, username, real_name"
        ).in_("id", list(user_ids)).execute()
        profiles_map = {p["id"]: p for p in profiles_response.data}
        
        packages_response = supabase_admin.table("gift_packages").select(
            "id, name, amount"
        ).in_("id", list(package_ids)).execute() if package_ids else type("obj", (), {"data": []})()
        packages_map = {p["id"]: p for p in packages_response.data}
        
        gifts = []
        for g in response.data:
            gifts.append(GiftHistoryItem(
                id=g["id"],
                from_user_id=g["from_user_id"],
                to_user_id=g["to_user_id"],
                amount=g["amount"],
                commission_amount=float(g.get("commission_amount", 0)),
                receiver_amount=float(g.get("receiver_amount", 0)),
                status=g.get("status", "completed"),
                created_at=g["created_at"],
                from_user=profiles_map.get(g["from_user_id"]),
                to_user=profiles_map.get(g["to_user_id"]),
                package=packages_map.get(g.get("package_id"))
            ))
        
        return GiftHistoryResponse(
            success=True,
            gifts=gifts,
            total_count=response.count or len(gifts)
        )
        
    except HTTPException:
        raise
    except Exception as err:
        raise HTTPException(status_code=400, detail=str(err))


@router.post("/add-balance")
async def add_balance(
    amount: int = Query(..., ge=1, le=10000),
    authorization: str = Header(None)
):
    """Add balance to user account (for testing/admin)"""
    try:
        user_id = get_user_from_token(authorization)
        
        # Get current balance
        balance_response = supabase_admin.table("user_balances").select("*").eq(
            "user_id", user_id
        ).execute()
        
        if balance_response.data:
            current = balance_response.data[0]
            new_balance = float(current.get("balance", 0)) + amount
            supabase_admin.table("user_balances").update({
                "balance": new_balance
            }).eq("user_id", user_id).execute()
        else:
            supabase_admin.table("user_balances").insert({
                "user_id": user_id,
                "balance": amount,
                "total_received": 0,
                "total_sent": 0
            }).execute()
            new_balance = amount
        
        return {
            "success": True,
            "message": f"Added {amount} coins to your balance",
            "new_balance": new_balance
        }
        
    except HTTPException:
        raise
    except Exception as err:
        raise HTTPException(status_code=400, detail=str(err))
