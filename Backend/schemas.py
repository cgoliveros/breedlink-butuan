from pydantic import BaseModel, EmailStr
from typing import Optional, Any
from datetime import datetime


# ─── Auth ────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    name: str
    email: EmailStr
    password: str
    accountType: str = "breeder"


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: int
    name: str
    email: str
    account_type: str
    phone: Optional[str] = ""
    location: Optional[str] = ""
    bio: Optional[str] = ""
    tags: Optional[list] = []
    contact: Optional[dict] = {}
    profile_picture: Optional[str] = ""
    cover_photo: Optional[str] = ""
    verified: bool = False
    stats: Optional[dict] = {}

    @classmethod
    def from_orm(cls, obj):
        return cls(
            id=obj.id,
            name=obj.name,
            email=obj.email,
            account_type=obj.account_type,
            phone=obj.phone or "",
            location=obj.location or "",
            bio=obj.bio or "",
            tags=obj.tags or [],
            contact=obj.contact or {},
            profile_picture=obj.profile_picture or "",
            cover_photo=obj.cover_photo or "",
            verified=obj.verified or False,
            stats=obj.stats or {},
        )

    model_config = {"from_attributes": True}

    def model_dump(self, **kwargs):
        d = super().model_dump(**kwargs)
        d["profilePicture"] = d.pop("profile_picture", "")
        d["coverPhoto"] = d.pop("cover_photo", "")
        d["accountType"] = d.pop("account_type", "")
        return d


class AuthResponse(BaseModel):
    token: str
    user: Any


# ─── User ────────────────────────────────────────────────────────

class UserUpdate(BaseModel):
    name: Optional[str] = None
    bio: Optional[str] = None
    phone: Optional[str] = None
    location: Optional[str] = None
    tags: Optional[list] = None
    contact: Optional[dict] = None
    profilePicture: Optional[str] = None
    coverPhoto: Optional[str] = None

    def dict(self, **kwargs):
        d = super().model_dump(exclude_none=True, **kwargs)
        if "profilePicture" in d:
            d["profile_picture"] = d.pop("profilePicture")
        if "coverPhoto" in d:
            d["cover_photo"] = d.pop("coverPhoto")
        return d


# ─── Pets ────────────────────────────────────────────────────────

class PetCreate(BaseModel):
    name: str
    breed: str
    gender: str = ""
    age: str = ""
    status: str = "Available"
    image: str = ""
    litter_count: int = 0
    partner: str = "None"
    health_certificates: list = []
    health_documents: list = []
    description: str = ""
    category: str = "Pet"


class PetUpdate(BaseModel):
    name: Optional[str] = None
    breed: Optional[str] = None
    gender: Optional[str] = None
    age: Optional[str] = None
    status: Optional[str] = None
    image: Optional[str] = None
    litter_count: Optional[int] = None
    partner: Optional[str] = None
    description: Optional[str] = None
    health_certificates: Optional[list] = None
    health_documents: Optional[list] = None
    category: Optional[str] = None


class PetOut(BaseModel):
    id: int
    name: str
    breed: str
    gender: str
    age: Optional[str] = ""
    status: Optional[str] = ""
    image: Optional[str] = ""
    litter_count: int
    partner: Optional[str] = ""
    description: Optional[str] = ""
    health_certificates: list
    health_documents: list
    category: Optional[str] = "Pet"
    owner_id: int

    model_config = {"from_attributes": True}

    def model_dump(self, **kwargs):
        d = super().model_dump(**kwargs)
        d["litterCount"] = d.pop("litter_count", 0)
        return d


class SwipePetOut(BaseModel):
    id: int
    name: str
    breed: str
    age: str
    gender: str
    status: str
    image: str
    litters: int
    rating: float
    verified: bool
    location: str
    owner: str
    phone: str
    email: str
    description: str
    documents: list
    category: str


# ─── Posts ───────────────────────────────────────────────────────

class PostCreate(BaseModel):
    text: str = ""
    image: Optional[str] = None


class PostUpdate(BaseModel):
    text: str


class PostOut(BaseModel):
    id: int
    text: str
    images: list
    createdAt: str
    author: dict
    authorImg: str
    likes: list
    liked: bool
    saved: bool
    comments: list


# ─── Comments ────────────────────────────────────────────────────

class CommentCreate(BaseModel):
    text: str


# ─── Swipe ───────────────────────────────────────────────────────

class SwipeAction(BaseModel):
    petId: int
    direction: str   # "like" or "dislike"


# ─── Messages ────────────────────────────────────────────────────

class MessageCreate(BaseModel):
    to: int
    text: Optional[str] = ""
    image: Optional[str] = ""


# ─── Connections ─────────────────────────────────────────────────

class ConnectionOut(BaseModel):
    id: int
    user_id: int
    connected_user_id: int
    status: str
    name: str
    profile_picture: str

    model_config = {"from_attributes": True}


# ─── Reviews ─────────────────────────────────────────────────────

class ReviewCreate(BaseModel):
    reviewed_user_id: int
    rating: int
    comment: Optional[str] = ""


class ReviewOut(BaseModel):
    id: int
    reviewer_id: int
    reviewed_user_id: int
    rating: int
    comment: str
    reviewer_name: str
    reviewer_picture: str
    created_at: str


# ─── Notifications ───────────────────────────────────────────────

class NotificationOut(BaseModel):
    id: int
    type: str
    message: str
    related_id: Optional[int] = None
    read: bool
    created_at: str
