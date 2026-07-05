"""Ghar.com backend - Property rental & sale platform."""
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Header, Query
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import jwt as pyjwt
import uuid
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Literal
from datetime import datetime, timezone, timedelta

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

MONGO_URL = os.environ['MONGO_URL']
DB_NAME = os.environ['DB_NAME']
JWT_SECRET = os.environ.get('JWT_SECRET', 'ghar-dev-secret')
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY')

MOCK_OTP = "123456"
# Ghar Connect bridge number - our company employee mediates buyer<->owner calls
GHAR_BRIDGE_PHONE = "+911800GHARCOM"  # display; real dial number
GHAR_BRIDGE_DIAL = "+919000012345"

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

app = FastAPI(title="Ghar.com API")
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


# ----------- Models -----------
class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    phone: str
    name: Optional[str] = None
    email: Optional[str] = None
    role: Literal["owner", "buyer", "admin"] = "buyer"
    verified: bool = False
    profile_complete: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class SendOtpReq(BaseModel):
    phone: str


class VerifyOtpReq(BaseModel):
    phone: str
    otp: str


class CompleteProfileReq(BaseModel):
    name: str
    email: Optional[str] = None
    role: Literal["owner", "buyer"] = "buyer"


class PropertyCreate(BaseModel):
    title: str
    description: str = ""
    listing_type: Literal["rent", "sale"]  # rent | sale
    category: str  # apartment, villa, pg, shop, office, plot, etc.
    property_type: Literal["residential", "commercial", "land"] = "residential"
    price: float
    security_deposit: float = 0
    maintenance: float = 0
    state: str
    city: str
    locality: str
    pincode: str = ""
    bedrooms: int = 0
    bathrooms: int = 0
    balconies: int = 0
    floor: int = 0
    total_floors: int = 0
    area: float = 0  # sq ft
    furnishing: str = "unfurnished"  # unfurnished | semi-furnished | furnished
    amenities: List[str] = []
    images: List[str] = []  # base64 strings
    ready_to_move: bool = True
    pet_friendly: bool = False


class Property(PropertyCreate):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    owner_id: str
    status: Literal["pending", "approved", "rejected", "rented", "sold"] = "pending"
    featured: bool = False
    verified: bool = False
    views: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class VisitRequestCreate(BaseModel):
    property_id: str
    scheduled_date: str  # ISO date string
    message: str = ""


class VisitRequest(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    property_id: str
    buyer_id: str
    owner_id: str
    scheduled_date: str
    message: str = ""
    status: Literal["pending", "accepted", "rejected"] = "pending"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ChatMessageCreate(BaseModel):
    property_id: str
    to_user_id: str
    text: str


class ChatMessage(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    thread_id: str  # combo of property + participants
    property_id: str
    from_user_id: str
    to_user_id: str
    text: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class AIDescReq(BaseModel):
    title: str
    category: str
    listing_type: str
    bedrooms: int = 0
    area: float = 0
    city: str = ""
    locality: str = ""
    amenities: List[str] = []
    price: float = 0


class ChatBotMsg(BaseModel):
    session_id: str
    message: str


class ReviewCreate(BaseModel):
    property_id: str
    rating: int  # 1..5
    comment: str = ""


class Review(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    property_id: str
    user_id: str
    user_name: str = ""
    rating: int
    comment: str = ""
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class CallRequestCreate(BaseModel):
    property_id: str


class CallRequest(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    property_id: str
    property_title: str = ""
    caller_id: str
    caller_name: str = ""
    caller_phone: str = ""
    owner_id: str
    owner_name: str = ""
    owner_phone: str = ""
    status: Literal["pending", "connected", "missed"] = "pending"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class PriceSuggestReq(BaseModel):
    city: str
    locality: str
    category: str
    listing_type: str
    area: float
    bedrooms: int = 0


class DuplicateCheckReq(BaseModel):
    title: str
    city: str
    locality: str
    bedrooms: int = 0


# ----------- Auth helpers -----------
def create_token(user_id: str) -> str:
    payload = {"sub": user_id, "exp": datetime.now(timezone.utc) + timedelta(days=30)}
    return pyjwt.encode(payload, JWT_SECRET, algorithm="HS256")


async def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing auth token")
    token = authorization.split(" ", 1)[1]
    try:
        payload = pyjwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        user_id = payload["sub"]
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    return user


def sanitize(doc: dict) -> dict:
    if not doc:
        return doc
    doc.pop("_id", None)
    return doc


def _normalize_phone(p: str) -> str:
    """Normalize to +91XXXXXXXXXX format. Accepts bare 10-digit or +91-prefixed."""
    digits = ''.join(c for c in (p or '') if c.isdigit())
    # If already 12 digits with country code (91XXXXXXXXXX) strip to 10
    if len(digits) == 12 and digits.startswith('91'):
        digits = digits[2:]
    if len(digits) != 10:
        return p or ''  # let validator downstream reject
    return f"+91{digits}"


# ----------- Auth Routes -----------
@api_router.post("/auth/send-otp")
async def send_otp(req: SendOtpReq):
    phone = _normalize_phone(req.phone)
    if not phone.startswith("+91"):
        raise HTTPException(status_code=400, detail="Invalid phone number")
    logger.info(f"Sending OTP to {phone}: {MOCK_OTP}")
    return {"success": True, "message": "OTP sent successfully", "hint": f"Use {MOCK_OTP} for demo"}


@api_router.post("/auth/verify-otp")
async def verify_otp(req: VerifyOtpReq):
    phone = _normalize_phone(req.phone)
    if not phone.startswith("+91"):
        raise HTTPException(status_code=400, detail="Invalid phone number")
    if req.otp != MOCK_OTP:
        raise HTTPException(status_code=400, detail="Invalid OTP")
    existing = await db.users.find_one({"phone": phone}, {"_id": 0})
    if existing:
        token = create_token(existing["id"])
        return {"token": token, "user": existing, "is_new": False}
    new_user = User(phone=phone, verified=True)
    await db.users.insert_one(new_user.model_dump())
    token = create_token(new_user.id)
    return {"token": token, "user": new_user.model_dump(), "is_new": True}


@api_router.post("/auth/complete-profile")
async def complete_profile(req: CompleteProfileReq, user: dict = Depends(get_current_user)):
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"name": req.name, "email": req.email, "role": req.role, "profile_complete": True}},
    )
    updated = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    return {"user": sanitize(updated)}


@api_router.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return {"user": user}


# ----------- Property Routes -----------
@api_router.post("/properties", response_model=Property)
async def create_property(payload: PropertyCreate, user: dict = Depends(get_current_user)):
    if user.get("role") != "owner":
        raise HTTPException(status_code=403, detail="Only owners can list properties")
    prop = Property(**payload.model_dump(), owner_id=user["id"])
    await db.properties.insert_one(prop.model_dump())
    return prop


@api_router.get("/properties")
async def list_properties(
    listing_type: Optional[str] = None,
    city: Optional[str] = None,
    category: Optional[str] = None,
    property_type: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    bedrooms: Optional[int] = None,
    furnishing: Optional[str] = None,
    ready_to_move: Optional[bool] = None,
    verified: Optional[bool] = None,
    featured: Optional[bool] = None,
    q: Optional[str] = None,
    limit: int = Query(50, le=100),
):
    query = {"status": "approved"}
    if listing_type:
        query["listing_type"] = listing_type
    if city:
        query["city"] = {"$regex": city, "$options": "i"}
    if category:
        query["category"] = category
    if property_type:
        query["property_type"] = property_type
    if bedrooms is not None:
        query["bedrooms"] = bedrooms
    if furnishing:
        query["furnishing"] = furnishing
    if ready_to_move is not None:
        query["ready_to_move"] = ready_to_move
    if verified is not None:
        query["verified"] = verified
    if featured is not None:
        query["featured"] = featured
    if min_price is not None or max_price is not None:
        pr = {}
        if min_price is not None:
            pr["$gte"] = min_price
        if max_price is not None:
            pr["$lte"] = max_price
        query["price"] = pr
    if q:
        query["$or"] = [
            {"title": {"$regex": q, "$options": "i"}},
            {"description": {"$regex": q, "$options": "i"}},
            {"locality": {"$regex": q, "$options": "i"}},
            {"city": {"$regex": q, "$options": "i"}},
        ]
    cursor = db.properties.find(query, {"_id": 0}).sort("created_at", -1).limit(limit)
    return await cursor.to_list(length=limit)


@api_router.get("/properties/mine")
async def my_properties(user: dict = Depends(get_current_user)):
    cursor = db.properties.find({"owner_id": user["id"]}, {"_id": 0}).sort("created_at", -1)
    return await cursor.to_list(length=200)


@api_router.get("/properties/{property_id}")
async def get_property(property_id: str):
    prop = await db.properties.find_one({"id": property_id}, {"_id": 0})
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")
    await db.properties.update_one({"id": property_id}, {"$inc": {"views": 1}})
    owner = await db.users.find_one({"id": prop["owner_id"]}, {"_id": 0, "phone": 1, "name": 1, "id": 1, "verified": 1})
    prop["owner"] = sanitize(owner) if owner else None
    return prop


@api_router.put("/properties/{property_id}")
async def update_property(property_id: str, payload: PropertyCreate, user: dict = Depends(get_current_user)):
    prop = await db.properties.find_one({"id": property_id}, {"_id": 0})
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")
    if prop["owner_id"] != user["id"] and user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Not your property")
    await db.properties.update_one(
        {"id": property_id},
        {"$set": {**payload.model_dump(), "status": "pending"}},  # re-approval on edit
    )
    updated = await db.properties.find_one({"id": property_id}, {"_id": 0})
    return sanitize(updated)


@api_router.delete("/properties/{property_id}")
async def delete_property(property_id: str, user: dict = Depends(get_current_user)):
    prop = await db.properties.find_one({"id": property_id}, {"_id": 0})
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")
    if prop["owner_id"] != user["id"] and user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Not allowed")
    await db.properties.delete_one({"id": property_id})
    return {"success": True}


# ----------- Wishlist -----------
@api_router.post("/wishlist/{property_id}")
async def add_wishlist(property_id: str, user: dict = Depends(get_current_user)):
    prop = await db.properties.find_one({"id": property_id}, {"_id": 0})
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")
    doc = {"user_id": user["id"], "property_id": property_id, "created_at": datetime.now(timezone.utc)}
    await db.wishlist.update_one(
        {"user_id": user["id"], "property_id": property_id},
        {"$setOnInsert": doc},
        upsert=True,
    )
    return {"success": True}


@api_router.delete("/wishlist/{property_id}")
async def remove_wishlist(property_id: str, user: dict = Depends(get_current_user)):
    await db.wishlist.delete_one({"user_id": user["id"], "property_id": property_id})
    return {"success": True}


@api_router.get("/wishlist")
async def get_wishlist(user: dict = Depends(get_current_user)):
    entries = await db.wishlist.find({"user_id": user["id"]}, {"_id": 0}).to_list(length=200)
    prop_ids = [e["property_id"] for e in entries]
    if not prop_ids:
        return []
    props = await db.properties.find({"id": {"$in": prop_ids}}, {"_id": 0}).to_list(length=200)
    return props


# ----------- Visit Requests -----------
@api_router.post("/visits")
async def create_visit(payload: VisitRequestCreate, user: dict = Depends(get_current_user)):
    prop = await db.properties.find_one({"id": payload.property_id}, {"_id": 0})
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")
    v = VisitRequest(
        property_id=payload.property_id,
        buyer_id=user["id"],
        owner_id=prop["owner_id"],
        scheduled_date=payload.scheduled_date,
        message=payload.message,
    )
    await db.visits.insert_one(v.model_dump())
    return v.model_dump()


@api_router.get("/visits")
async def list_visits(user: dict = Depends(get_current_user)):
    # Owner sees requests to them; buyer sees their own
    q = {"$or": [{"buyer_id": user["id"]}, {"owner_id": user["id"]}]}
    visits = await db.visits.find(q, {"_id": 0}).sort("created_at", -1).to_list(length=200)
    # attach property info
    prop_ids = list({v["property_id"] for v in visits})
    props = {p["id"]: p for p in await db.properties.find({"id": {"$in": prop_ids}}, {"_id": 0}).to_list(length=200)}
    for v in visits:
        v["property"] = props.get(v["property_id"])
    return visits


@api_router.put("/visits/{visit_id}")
async def update_visit(visit_id: str, status: str, user: dict = Depends(get_current_user)):
    v = await db.visits.find_one({"id": visit_id}, {"_id": 0})
    if not v:
        raise HTTPException(status_code=404, detail="Visit not found")
    if v["owner_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Not allowed")
    if status not in ("accepted", "rejected"):
        raise HTTPException(status_code=400, detail="Invalid status")
    await db.visits.update_one({"id": visit_id}, {"$set": {"status": status}})
    return {"success": True}


# ----------- Chat -----------
def _thread_id(property_id: str, u1: str, u2: str) -> str:
    users = sorted([u1, u2])
    return f"{property_id}:{users[0]}:{users[1]}"


@api_router.post("/chats/messages")
async def send_message(payload: ChatMessageCreate, user: dict = Depends(get_current_user)):
    tid = _thread_id(payload.property_id, user["id"], payload.to_user_id)
    msg = ChatMessage(
        thread_id=tid,
        property_id=payload.property_id,
        from_user_id=user["id"],
        to_user_id=payload.to_user_id,
        text=payload.text,
    )
    await db.messages.insert_one(msg.model_dump())
    return msg.model_dump()


@api_router.get("/chats/threads")
async def list_threads(user: dict = Depends(get_current_user)):
    pipeline = [
        {"$match": {"$or": [{"from_user_id": user["id"]}, {"to_user_id": user["id"]}]}},
        {"$sort": {"created_at": -1}},
        {"$group": {
            "_id": "$thread_id",
            "last": {"$first": "$$ROOT"},
        }},
        {"$sort": {"last.created_at": -1}},
    ]
    docs = await db.messages.aggregate(pipeline).to_list(length=100)
    threads = []
    for d in docs:
        last = d["last"]
        last.pop("_id", None)
        other_id = last["to_user_id"] if last["from_user_id"] == user["id"] else last["from_user_id"]
        other = await db.users.find_one({"id": other_id}, {"_id": 0, "name": 1, "phone": 1, "id": 1})
        prop = await db.properties.find_one({"id": last["property_id"]}, {"_id": 0, "title": 1, "images": 1, "id": 1})
        threads.append({
            "thread_id": d["_id"],
            "last_message": last,
            "other_user": sanitize(other),
            "property": sanitize(prop),
        })
    return threads


@api_router.get("/chats/thread")
async def get_thread(property_id: str, other_user_id: str, user: dict = Depends(get_current_user)):
    tid = _thread_id(property_id, user["id"], other_user_id)
    msgs = await db.messages.find({"thread_id": tid}, {"_id": 0}).sort("created_at", 1).to_list(length=500)
    other = await db.users.find_one({"id": other_user_id}, {"_id": 0, "name": 1, "phone": 1, "id": 1})
    prop = await db.properties.find_one({"id": property_id}, {"_id": 0, "title": 1, "id": 1, "images": 1, "price": 1, "listing_type": 1})
    return {"messages": msgs, "other_user": sanitize(other), "property": sanitize(prop), "thread_id": tid}


# ----------- Admin -----------
@api_router.get("/admin/stats")
async def admin_stats(user: dict = Depends(require_admin)):
    total_users = await db.users.count_documents({})
    total_owners = await db.users.count_documents({"role": "owner"})
    total_props = await db.properties.count_documents({})
    pending = await db.properties.count_documents({"status": "pending"})
    approved = await db.properties.count_documents({"status": "approved"})
    rent = await db.properties.count_documents({"listing_type": "rent", "status": "approved"})
    sale = await db.properties.count_documents({"listing_type": "sale", "status": "approved"})
    return {
        "total_users": total_users,
        "total_owners": total_owners,
        "total_properties": total_props,
        "pending_verification": pending,
        "approved": approved,
        "total_rent": rent,
        "total_sale": sale,
    }


@api_router.get("/admin/properties")
async def admin_list_properties(status: Optional[str] = None, user: dict = Depends(require_admin)):
    q = {}
    if status:
        q["status"] = status
    props = await db.properties.find(q, {"_id": 0}).sort("created_at", -1).to_list(length=200)
    return props


@api_router.put("/admin/properties/{property_id}/approve")
async def approve_property(property_id: str, user: dict = Depends(require_admin)):
    await db.properties.update_one({"id": property_id}, {"$set": {"status": "approved", "verified": True}})
    return {"success": True}


@api_router.put("/admin/properties/{property_id}/reject")
async def reject_property(property_id: str, user: dict = Depends(require_admin)):
    await db.properties.update_one({"id": property_id}, {"$set": {"status": "rejected"}})
    return {"success": True}


@api_router.put("/admin/properties/{property_id}/feature")
async def feature_property(property_id: str, featured: bool = True, user: dict = Depends(require_admin)):
    await db.properties.update_one({"id": property_id}, {"$set": {"featured": featured}})
    return {"success": True}


# ----------- AI Description Generator -----------
@api_router.post("/ai/generate-description")
async def generate_description(req: AIDescReq, user: dict = Depends(get_current_user)):
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage, TextDelta
    except ImportError:
        raise HTTPException(status_code=500, detail="AI service not available")

    if not EMERGENT_LLM_KEY:
        raise HTTPException(status_code=500, detail="AI key not configured")

    prompt = f"""Generate a compelling 3-4 sentence property description for a real estate listing in India.

Property details:
- Title: {req.title}
- Category: {req.category}
- Listing type: {req.listing_type} (rent or sale)
- Bedrooms (BHK): {req.bedrooms}
- Area: {req.area} sq ft
- Location: {req.locality}, {req.city}
- Amenities: {', '.join(req.amenities) if req.amenities else 'none'}
- Price: Rs {req.price:,.0f}

Write in engaging English, highlight lifestyle benefits, mention key amenities. Keep it under 80 words. Only output the description, no title or bullet points."""

    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"desc-{uuid.uuid4()}",
        system_message="You are a professional real estate copywriter for Indian property listings. Write concise, engaging descriptions.",
    ).with_model("gemini", "gemini-3-flash-preview")

    try:
        text_parts: List[str] = []
        async for ev in chat.stream_message(UserMessage(text=prompt)):
            if isinstance(ev, TextDelta):
                text_parts.append(ev.content)
        description = "".join(text_parts).strip()
        if not description:
            raise HTTPException(status_code=500, detail="Empty AI response")
        return {"description": description}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("AI generation failed")
        raise HTTPException(status_code=500, detail=f"AI generation failed: {e}")


# ----------- Reviews -----------
@api_router.get("/properties/{property_id}/reviews")
async def list_reviews(property_id: str):
    revs = await db.reviews.find({"property_id": property_id}, {"_id": 0}).sort("created_at", -1).to_list(length=200)
    agg = await db.reviews.aggregate([
        {"$match": {"property_id": property_id}},
        {"$group": {"_id": "$property_id", "avg": {"$avg": "$rating"}, "count": {"$sum": 1}}},
    ]).to_list(length=1)
    stats = agg[0] if agg else {"avg": 0, "count": 0}
    return {"reviews": revs, "avg_rating": round(stats.get("avg", 0), 1), "count": stats.get("count", 0)}


@api_router.post("/properties/{property_id}/reviews")
async def add_review(property_id: str, payload: ReviewCreate, user: dict = Depends(get_current_user)):
    prop = await db.properties.find_one({"id": property_id}, {"_id": 0})
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")
    if not 1 <= payload.rating <= 5:
        raise HTTPException(status_code=400, detail="Rating must be 1-5")
    # one review per user per property (upsert)
    r = Review(
        property_id=property_id,
        user_id=user["id"],
        user_name=user.get("name") or "User",
        rating=payload.rating,
        comment=payload.comment,
    )
    await db.reviews.update_one(
        {"property_id": property_id, "user_id": user["id"]},
        {"$set": r.model_dump()},
        upsert=True,
    )
    return r.model_dump()


# ----------- Bridge Call Logging -----------
@api_router.post("/bridge-calls")
async def log_bridge_call(payload: CallRequestCreate, user: dict = Depends(get_current_user)):
    prop = await db.properties.find_one({"id": payload.property_id}, {"_id": 0})
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")
    owner = await db.users.find_one({"id": prop["owner_id"]}, {"_id": 0})
    req = CallRequest(
        property_id=payload.property_id,
        property_title=prop.get("title", ""),
        caller_id=user["id"],
        caller_name=user.get("name") or "User",
        caller_phone=user.get("phone", ""),
        owner_id=prop["owner_id"],
        owner_name=(owner or {}).get("name", ""),
        owner_phone=(owner or {}).get("phone", ""),
    )
    await db.call_requests.insert_one(req.model_dump())
    return req.model_dump()


# ----------- AI Price Suggestion -----------
@api_router.post("/ai/price-suggest")
async def ai_price_suggest(req: PriceSuggestReq, user: dict = Depends(get_current_user)):
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage, TextDelta
    except ImportError:
        raise HTTPException(status_code=500, detail="AI service not available")
    if not EMERGENT_LLM_KEY:
        raise HTTPException(status_code=500, detail="AI key not configured")

    prompt = (
        f"You are a real-estate price analyst for India. Estimate a realistic per-square-foot rate range "
        f"(in INR) for the following property. Respond in this EXACT JSON format only, no extra text:\n"
        f'{{"per_sqft_min": <int>, "per_sqft_max": <int>, "estimated_total_min": <int>, "estimated_total_max": <int>, "note": "<one-line reasoning>"}}\n\n'
        f"Property: {req.category} in {req.locality}, {req.city}\n"
        f"Listing type: {req.listing_type} ({'monthly rent' if req.listing_type == 'rent' else 'sale price'})\n"
        f"Area: {req.area} sqft, Bedrooms: {req.bedrooms}\n\n"
        f"For RENT, use realistic monthly rent per sqft (usually ₹15-₹80). For SALE use per-sqft market rate "
        f"(₹4000-₹40000 depending on city tier). Multiply by area for total."
    )
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"price-{uuid.uuid4()}",
        system_message="You are a precise Indian real-estate valuation assistant. Always respond in valid JSON only.",
    ).with_model("gemini", "gemini-3-flash-preview")

    parts: List[str] = []
    try:
        async for ev in chat.stream_message(UserMessage(text=prompt)):
            if isinstance(ev, TextDelta):
                parts.append(ev.content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI failed: {e}")

    raw = "".join(parts).strip()
    # extract JSON if wrapped in ```json ... ```
    if "```" in raw:
        import re
        m = re.search(r"\{[\s\S]*\}", raw)
        if m:
            raw = m.group(0)
    try:
        import json
        data = json.loads(raw)
        return data
    except Exception:
        return {"raw": raw, "note": "Could not parse structured price. Raw AI output shown."}


# ----------- AI Duplicate Detection -----------
@api_router.post("/ai/check-duplicate")
async def check_duplicate(req: DuplicateCheckReq, user: dict = Depends(get_current_user)):
    # Simple signal-based check + AI similarity on top matches
    q = {
        "city": {"$regex": f"^{req.city}$", "$options": "i"},
        "locality": {"$regex": req.locality, "$options": "i"},
    }
    if req.bedrooms:
        q["bedrooms"] = req.bedrooms
    candidates = await db.properties.find(q, {"_id": 0, "id": 1, "title": 1, "locality": 1, "city": 1, "bedrooms": 1, "owner_id": 1}).limit(10).to_list(length=10)
    # Filter out user's own listings
    candidates = [c for c in candidates if c.get("owner_id") != user["id"]]
    if not candidates:
        return {"duplicate": False, "matches": []}
    # Signal-based title similarity (Jaccard on words)
    def sim(a: str, b: str) -> float:
        wa = set(w.lower() for w in a.split() if len(w) > 2)
        wb = set(w.lower() for w in b.split() if len(w) > 2)
        if not wa or not wb:
            return 0.0
        return len(wa & wb) / len(wa | wb)

    scored = [
        {**c, "similarity": round(sim(req.title, c.get("title", "")), 2)}
        for c in candidates
    ]
    scored.sort(key=lambda x: x["similarity"], reverse=True)
    top = scored[:3]
    is_dup = any(x["similarity"] >= 0.5 for x in top)
    return {"duplicate": is_dup, "matches": top}


# ----------- Admin extras -----------
@api_router.get("/admin/users")
async def admin_users(user: dict = Depends(require_admin)):
    users = await db.users.find({}, {"_id": 0}).sort("created_at", -1).to_list(length=500)
    return users


@api_router.get("/admin/call-requests")
async def admin_call_requests(user: dict = Depends(require_admin)):
    reqs = await db.call_requests.find({}, {"_id": 0}).sort("created_at", -1).to_list(length=300)
    return reqs


@api_router.get("/admin/messages")
async def admin_messages(user: dict = Depends(require_admin)):
    """All chat messages across the platform with sender/receiver + property context."""
    msgs = await db.messages.find({}, {"_id": 0}).sort("created_at", -1).limit(500).to_list(length=500)
    # Batch fetch users and properties for enrichment
    user_ids = {m["from_user_id"] for m in msgs} | {m["to_user_id"] for m in msgs}
    prop_ids = {m["property_id"] for m in msgs}
    users = {u["id"]: u for u in await db.users.find(
        {"id": {"$in": list(user_ids)}}, {"_id": 0, "id": 1, "name": 1, "phone": 1, "role": 1}
    ).to_list(length=500)}
    props = {p["id"]: p for p in await db.properties.find(
        {"id": {"$in": list(prop_ids)}}, {"_id": 0, "id": 1, "title": 1, "city": 1}
    ).to_list(length=500)}
    for m in msgs:
        m["from_user"] = users.get(m["from_user_id"])
        m["to_user"] = users.get(m["to_user_id"])
        m["property"] = props.get(m["property_id"])
    return msgs


@api_router.get("/admin/visits")
async def admin_visits(user: dict = Depends(require_admin)):
    """All visit requests with buyer + owner + property info."""
    visits = await db.visits.find({}, {"_id": 0}).sort("created_at", -1).to_list(length=300)
    user_ids = {v["buyer_id"] for v in visits} | {v["owner_id"] for v in visits}
    prop_ids = {v["property_id"] for v in visits}
    users = {u["id"]: u for u in await db.users.find(
        {"id": {"$in": list(user_ids)}}, {"_id": 0, "id": 1, "name": 1, "phone": 1}
    ).to_list(length=300)}
    props = {p["id"]: p for p in await db.properties.find(
        {"id": {"$in": list(prop_ids)}}, {"_id": 0, "id": 1, "title": 1, "city": 1, "listing_type": 1}
    ).to_list(length=300)}
    for v in visits:
        v["buyer"] = users.get(v["buyer_id"])
        v["owner"] = users.get(v["owner_id"])
        v["property"] = props.get(v["property_id"])
    return visits


@api_router.get("/admin/reviews")
async def admin_reviews(user: dict = Depends(require_admin)):
    """All property reviews across the platform."""
    revs = await db.reviews.find({}, {"_id": 0}).sort("created_at", -1).limit(500).to_list(length=500)
    prop_ids = {r["property_id"] for r in revs}
    props = {p["id"]: p for p in await db.properties.find(
        {"id": {"$in": list(prop_ids)}}, {"_id": 0, "id": 1, "title": 1, "city": 1}
    ).to_list(length=500)}
    for r in revs:
        r["property"] = props.get(r["property_id"])
    return revs


@api_router.delete("/admin/reviews/{review_id}")
async def admin_delete_review(review_id: str, user: dict = Depends(require_admin)):
    await db.reviews.delete_one({"id": review_id})
    return {"success": True}


@api_router.get("/admin/dashboard")
async def admin_dashboard(user: dict = Depends(require_admin)):
    """Rich dashboard: counts + trend + top cities + recent activity."""
    now = datetime.now(timezone.utc)
    seven_days_ago = now - timedelta(days=7)

    total_users = await db.users.count_documents({})
    total_owners = await db.users.count_documents({"role": "owner"})
    total_buyers = await db.users.count_documents({"role": "buyer"})
    total_props = await db.properties.count_documents({})
    pending = await db.properties.count_documents({"status": "pending"})
    approved = await db.properties.count_documents({"status": "approved"})
    rent = await db.properties.count_documents({"listing_type": "rent", "status": "approved"})
    sale = await db.properties.count_documents({"listing_type": "sale", "status": "approved"})
    total_calls = await db.call_requests.count_documents({})
    total_visits = await db.visits.count_documents({})
    total_messages = await db.messages.count_documents({})
    total_reviews = await db.reviews.count_documents({})

    new_users_7d = await db.users.count_documents({"created_at": {"$gte": seven_days_ago}})
    new_props_7d = await db.properties.count_documents({"created_at": {"$gte": seven_days_ago}})
    new_calls_7d = await db.call_requests.count_documents({"created_at": {"$gte": seven_days_ago}})

    # Top 5 cities by listing count
    top_cities_pipeline = [
        {"$match": {"status": "approved"}},
        {"$group": {"_id": "$city", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 5},
    ]
    top_cities = [
        {"city": doc["_id"], "count": doc["count"]}
        for doc in await db.properties.aggregate(top_cities_pipeline).to_list(length=5)
    ]

    # Recent activity: last 10 across calls + visits + new users
    recent_calls = await db.call_requests.find({}, {"_id": 0}).sort("created_at", -1).limit(5).to_list(length=5)
    recent_visits = await db.visits.find({}, {"_id": 0}).sort("created_at", -1).limit(5).to_list(length=5)

    return {
        "totals": {
            "users": total_users,
            "owners": total_owners,
            "buyers": total_buyers,
            "properties": total_props,
            "pending": pending,
            "approved": approved,
            "rent": rent,
            "sale": sale,
            "calls": total_calls,
            "visits": total_visits,
            "messages": total_messages,
            "reviews": total_reviews,
        },
        "last_7_days": {
            "new_users": new_users_7d,
            "new_properties": new_props_7d,
            "new_calls": new_calls_7d,
        },
        "top_cities": top_cities,
        "recent_calls": recent_calls,
        "recent_visits": recent_visits,
    }


@api_router.put("/admin/call-requests/{req_id}")
async def admin_update_call(req_id: str, status: str, user: dict = Depends(require_admin)):
    if status not in ("pending", "connected", "missed"):
        raise HTTPException(status_code=400, detail="Invalid status")
    await db.call_requests.update_one({"id": req_id}, {"$set": {"status": status}})
    return {"success": True}


# ----------- Seed / Health -----------
@api_router.get("/")
async def root():
    return {"message": "Ghar.com API", "status": "ok"}


@api_router.get("/config/bridge")
async def get_bridge_number():
    """Ghar Connect bridge — every property Call button routes here.
    Our employee then patches buyer and owner on a 3-way call. No broker fees."""
    return {"display": GHAR_BRIDGE_PHONE, "dial": GHAR_BRIDGE_DIAL, "label": "Ghar Connect"}


# ----------- AI Chatbot (Ghar Assistant) -----------
@api_router.post("/ai/chat")
async def ai_chat(req: ChatBotMsg, user: dict = Depends(get_current_user)):
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage, TextDelta
    except ImportError:
        raise HTTPException(status_code=500, detail="AI service not available")
    if not EMERGENT_LLM_KEY:
        raise HTTPException(status_code=500, detail="AI key not configured")

    # Persist message history for context
    await db.bot_messages.insert_one({
        "session_id": req.session_id,
        "user_id": user["id"],
        "role": "user",
        "text": req.message,
        "created_at": datetime.now(timezone.utc),
    })

    system = (
        "You are Ghar Assistant, a friendly, concise real-estate helper for Ghar.com — India's no-broker "
        "property platform. You help users search for properties, understand rental/purchase terms, explain "
        "amenities, guide them through listing, and answer common questions about paperwork (rent agreement, "
        "stamp duty, home loan basics). Never recommend brokers. If asked to speak with the owner, tell them "
        "to tap the Call or Chat button on the property page — Ghar Connect bridges the call. "
        "Keep answers under 90 words. Use short paragraphs. Prefer Indian context (₹ symbol, cities like "
        "Mumbai/Bengaluru/Delhi, BHK terminology). If user writes in Hindi/Hinglish, reply in the same style."
    )

    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=req.session_id,
        system_message=system,
    ).with_model("gemini", "gemini-3-flash-preview")

    try:
        parts: List[str] = []
        async for ev in chat.stream_message(UserMessage(text=req.message)):
            if isinstance(ev, TextDelta):
                parts.append(ev.content)
        reply = "".join(parts).strip() or "I'm having trouble right now. Please try again."
    except Exception as e:
        logger.exception("AI chat failed")
        raise HTTPException(status_code=500, detail=f"AI chat failed: {e}")

    await db.bot_messages.insert_one({
        "session_id": req.session_id,
        "user_id": user["id"],
        "role": "assistant",
        "text": reply,
        "created_at": datetime.now(timezone.utc),
    })
    return {"reply": reply}


@api_router.get("/ai/chat/history")
async def ai_chat_history(session_id: str, user: dict = Depends(get_current_user)):
    msgs = await db.bot_messages.find(
        {"session_id": session_id, "user_id": user["id"]}, {"_id": 0}
    ).sort("created_at", 1).to_list(length=200)
    return msgs


SAMPLE_IMAGES = [
    "https://images.pexels.com/photos/18153132/pexels-photo-18153132.jpeg",
    "https://images.pexels.com/photos/35339499/pexels-photo-35339499.jpeg",
    "https://images.pexels.com/photos/20418771/pexels-photo-20418771.jpeg",
    "https://images.pexels.com/photos/8146330/pexels-photo-8146330.jpeg",
]


async def seed_data():
    """Seed admin user and sample properties if empty."""
    # Ensure admin (create OR upgrade to admin role if user exists)
    admin = await db.users.find_one({"phone": "+919999999999"}, {"_id": 0})
    if not admin:
        # migrate legacy bare-number seeds if present
        await db.users.delete_many({"phone": {"$in": ["9999999999", "9111111111", "9222222222"]}})
        admin_user = User(
            phone="+919999999999",
            name="Ghar Admin",
            email="admin@ghar.com",
            role="admin",
            verified=True,
            profile_complete=True,
        )
        await db.users.insert_one(admin_user.model_dump())
        logger.info("Seeded admin user: phone=+919999999999 otp=123456")
    elif admin.get("role") != "admin":
        await db.users.update_one(
            {"phone": "+919999999999"},
            {"$set": {"role": "admin", "name": admin.get("name") or "Ghar Admin", "verified": True, "profile_complete": True}},
        )
        logger.info("Upgraded existing user to admin role: +919999999999")

    # Seed sample owner
    owner = await db.users.find_one({"phone": "+919111111111"}, {"_id": 0})
    if not owner:
        owner_user = User(
            phone="+919111111111",
            name="Rajesh Kumar",
            email="rajesh@example.com",
            role="owner",
            verified=True,
            profile_complete=True,
        )
        await db.users.insert_one(owner_user.model_dump())
        owner = owner_user.model_dump()

    # Seed sample buyer
    buyer = await db.users.find_one({"phone": "+919222222222"}, {"_id": 0})
    if not buyer:
        buyer_user = User(
            phone="+919222222222",
            name="Priya Sharma",
            email="priya@example.com",
            role="buyer",
            verified=True,
            profile_complete=True,
        )
        await db.users.insert_one(buyer_user.model_dump())

    # Seed properties if fewer than 4
    count = await db.properties.count_documents({})
    if count < 4:
        samples = [
            {
                "title": "Spacious 3BHK Apartment in Powai",
                "description": "Beautiful 3BHK apartment with modern amenities, ample parking, 24x7 security and lake view. Close to schools, hospitals and metro station. Ready to move with premium furnishing.",
                "listing_type": "rent", "category": "apartment", "property_type": "residential",
                "price": 55000, "security_deposit": 200000, "maintenance": 3500,
                "state": "Maharashtra", "city": "Mumbai", "locality": "Powai", "pincode": "400076",
                "bedrooms": 3, "bathrooms": 3, "balconies": 2, "floor": 12, "total_floors": 22, "area": 1450,
                "furnishing": "semi-furnished",
                "amenities": ["Lift", "Parking", "CCTV", "Gym", "Power Backup", "Swimming Pool"],
                "images": [SAMPLE_IMAGES[0], SAMPLE_IMAGES[2]],
                "ready_to_move": True, "pet_friendly": True, "featured": True, "verified": True,
            },
            {
                "title": "Premium 2BHK Villa in Whitefield",
                "description": "Luxurious independent villa with private garden, 2 covered parking and premium interior finish. Gated community with clubhouse and swimming pool.",
                "listing_type": "sale", "category": "villa", "property_type": "residential",
                "price": 12500000, "security_deposit": 0, "maintenance": 5000,
                "state": "Karnataka", "city": "Bengaluru", "locality": "Whitefield", "pincode": "560066",
                "bedrooms": 2, "bathrooms": 3, "balconies": 2, "floor": 0, "total_floors": 2, "area": 1800,
                "furnishing": "furnished",
                "amenities": ["Parking", "CCTV", "Garden", "Power Backup", "Water Supply", "WiFi"],
                "images": [SAMPLE_IMAGES[1], SAMPLE_IMAGES[3]],
                "ready_to_move": True, "pet_friendly": True, "featured": True, "verified": True,
            },
            {
                "title": "1BHK Cosy Flat near HITEC City",
                "description": "Well-ventilated 1BHK ideal for IT professionals. Walking distance from HITEC City and metro. Includes semi-furnished setup with wardrobe and modular kitchen.",
                "listing_type": "rent", "category": "apartment", "property_type": "residential",
                "price": 22000, "security_deposit": 60000, "maintenance": 1500,
                "state": "Telangana", "city": "Hyderabad", "locality": "Madhapur", "pincode": "500081",
                "bedrooms": 1, "bathrooms": 1, "balconies": 1, "floor": 4, "total_floors": 8, "area": 680,
                "furnishing": "semi-furnished",
                "amenities": ["Lift", "Parking", "CCTV", "Power Backup"],
                "images": [SAMPLE_IMAGES[2], SAMPLE_IMAGES[0]],
                "ready_to_move": True, "pet_friendly": False, "verified": True,
            },
            {
                "title": "Commercial Shop in Karol Bagh",
                "description": "Prime commercial shop on main road with high footfall. Ideal for retail, showroom or restaurant. Ground floor with shutter and washroom.",
                "listing_type": "rent", "category": "shop", "property_type": "commercial",
                "price": 85000, "security_deposit": 300000, "maintenance": 5000,
                "state": "Delhi", "city": "New Delhi", "locality": "Karol Bagh", "pincode": "110005",
                "bedrooms": 0, "bathrooms": 1, "balconies": 0, "floor": 0, "total_floors": 4, "area": 550,
                "furnishing": "unfurnished",
                "amenities": ["CCTV", "Power Backup", "Water Supply"],
                "images": [SAMPLE_IMAGES[3], SAMPLE_IMAGES[1]],
                "ready_to_move": True, "verified": True,
            },
            {
                "title": "4BHK Builder Floor in Gurgaon",
                "description": "Independent 4BHK builder floor in prime sector with lift, servant room and private terrace. Vaastu compliant with high-end fittings.",
                "listing_type": "sale", "category": "builder_floor", "property_type": "residential",
                "price": 21000000, "security_deposit": 0, "maintenance": 8000,
                "state": "Haryana", "city": "Gurgaon", "locality": "DLF Phase 4", "pincode": "122009",
                "bedrooms": 4, "bathrooms": 4, "balconies": 3, "floor": 2, "total_floors": 4, "area": 2400,
                "furnishing": "unfurnished",
                "amenities": ["Lift", "Parking", "CCTV", "Power Backup", "Water Supply"],
                "images": [SAMPLE_IMAGES[0], SAMPLE_IMAGES[3]],
                "ready_to_move": True, "featured": True, "verified": True,
            },
        ]
        for s in samples:
            p = Property(**s, owner_id=owner["id"], status="approved")
            await db.properties.insert_one(p.model_dump())
        logger.info(f"Seeded {len(samples)} sample properties")


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def on_startup():
    await seed_data()


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
