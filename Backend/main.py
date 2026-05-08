from fastapi import FastAPI, Depends, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
import uvicorn

from database import get_db, engine, Base
from auth import create_token, verify_token, hash_password, check_password
import models, schemas

import os

Base.metadata.create_all(bind=engine)

app = FastAPI(title="BreedLink API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("CLIENT_URL", "https://breedlinkbutuan.netlify.app")],          # Restrict to your frontend URL in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

security = HTTPBearer()


# ─────────────────────────── helpers ────────────────────────────

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
):
    user_id = verify_token(credentials.credentials)
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


def _create_notification(db: Session, user_id: int, type: str, message: str, related_id: int = None):
    notif = models.Notification(
        user_id=user_id,
        type=type,
        message=message,
        related_id=related_id,
    )
    db.add(notif)
    # Caller is responsible for db.commit()


# ═══════════════════════════ AUTH ═══════════════════════════════

@app.post("/api/register", response_model=schemas.AuthResponse, status_code=201)
def register(payload: schemas.RegisterRequest, db: Session = Depends(get_db)):
    if db.query(models.User).filter(models.User.email == payload.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    user = models.User(
        name=payload.name,
        email=payload.email,
        password_hash=hash_password(payload.password),   # uses password_hash column
        account_type=payload.accountType,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_token(user.id)
    user_out = schemas.UserOut.from_orm(user)
    return {"token": token, "user": user_out.model_dump()}


@app.post("/api/login", response_model=schemas.AuthResponse)
def login(payload: schemas.LoginRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == payload.email).first()
    if not user or not check_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_token(user.id)
    user_out = schemas.UserOut.from_orm(user)
    return {"token": token, "user": user_out.model_dump()}


# ═══════════════════════════ USER ════════════════════════════════

@app.get("/api/user")
def get_user(current_user: models.User = Depends(get_current_user)):
    return schemas.UserOut.from_orm(current_user).model_dump()


@app.get("/api/users/{user_id}")
def get_user_by_id(user_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return schemas.UserOut.from_orm(user).model_dump()


@app.put("/api/user")
def update_user(
    payload: schemas.UserUpdate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    data = payload.dict(exclude_unset=True)
    for key, value in data.items():
        setattr(current_user, key, value)
    db.commit()
    db.refresh(current_user)
    return schemas.UserOut.from_orm(current_user).model_dump()


# ═══════════════════════════ PETS ════════════════════════════════

@app.get("/api/pets", response_model=list[schemas.PetOut])
def get_pets(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return db.query(models.Pet).filter(models.Pet.owner_id == current_user.id).all()


@app.get("/api/pets/swipe-queue", response_model=list[schemas.SwipePetOut])
def get_swipe_queue(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Returns other users' pets that the current user hasn't swiped on yet."""
    swiped_ids = [
        s.pet_id for s in db.query(models.Swipe).filter(
            models.Swipe.swiper_id == current_user.id       # updated column name
        ).all()
    ]
    query = (
        db.query(models.Pet)
        .filter(models.Pet.owner_id != current_user.id)
        .limit(20)
    )
    if swiped_ids:
        query = query.filter(models.Pet.id.notin_(swiped_ids))
    pets = query.all()

    result = []
    for pet in pets:
        owner = db.query(models.User).filter(models.User.id == pet.owner_id).first()
        avg_rating = _get_avg_rating(owner.id, db)
        result.append(schemas.SwipePetOut(
            id=pet.id,
            name=pet.name,
            breed=pet.breed,
            age=pet.age or "",
            gender=pet.gender,
            status=pet.status or "",
            image=pet.image or "",
            litters=pet.litter_count,
            rating=round(avg_rating, 1),
            verified=owner.verified,
            location=owner.location or (owner.contact or {}).get("location", "Unknown"),
            owner=owner.name,
            phone=owner.phone or (owner.contact or {}).get("phone", ""),
            email=owner.email,
            description=pet.description or "",
            documents=pet.health_documents or [],
            category=pet.category or "Pet",
        ))
    return result


@app.post("/api/pets", response_model=schemas.PetOut, status_code=201)
def create_pet(
    payload: schemas.PetCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    pet = models.Pet(**payload.model_dump(), owner_id=current_user.id)
    db.add(pet)
    db.commit()
    db.refresh(pet)
    return pet


@app.put("/api/pets/{pet_id}", response_model=schemas.PetOut)
def update_pet(
    pet_id: int,
    payload: schemas.PetUpdate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    pet = db.query(models.Pet).filter(
        models.Pet.id == pet_id, models.Pet.owner_id == current_user.id
    ).first()
    if not pet:
        raise HTTPException(status_code=404, detail="Pet not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(pet, key, value)
    db.commit()
    db.refresh(pet)
    return pet


@app.delete("/api/pets/{pet_id}", status_code=204)
def delete_pet(
    pet_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    pet = db.query(models.Pet).filter(
        models.Pet.id == pet_id, models.Pet.owner_id == current_user.id
    ).first()
    if not pet:
        raise HTTPException(status_code=404, detail="Pet not found")
    db.delete(pet)
    db.commit()


# ═══════════════════════════ POSTS ═══════════════════════════════

@app.get("/api/posts", response_model=list[schemas.PostOut])
def get_posts(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    posts = (
        db.query(models.Post)
        .filter(models.Post.author_id == current_user.id)
        .order_by(models.Post.created_at.desc())
        .all()
    )
    return [_enrich_post(post, current_user.id, db) for post in posts]


@app.get("/api/feed", response_model=list[schemas.PostOut])
def get_feed(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Returns all posts (global feed) ordered by newest first."""
    posts = db.query(models.Post).order_by(models.Post.created_at.desc()).limit(50).all()
    return [_enrich_post(post, current_user.id, db) for post in posts]


@app.post("/api/posts", response_model=schemas.PostOut, status_code=201)
def create_post(
    payload: schemas.PostCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    images = [payload.image] if payload.image else []
    post = models.Post(
        text=payload.text,
        image=payload.image,
        images=images,
        author_id=current_user.id,
    )
    db.add(post)
    db.commit()
    db.refresh(post)
    return _enrich_post(post, current_user.id, db)


@app.put("/api/posts/{post_id}", response_model=schemas.PostOut)
def update_post(
    post_id: int,
    payload: schemas.PostUpdate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    post = db.query(models.Post).filter(
        models.Post.id == post_id, models.Post.author_id == current_user.id
    ).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    post.text = payload.text
    db.commit()
    db.refresh(post)
    return _enrich_post(post, current_user.id, db)


@app.delete("/api/posts/{post_id}", status_code=204)
def delete_post(
    post_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    post = db.query(models.Post).filter(
        models.Post.id == post_id, models.Post.author_id == current_user.id
    ).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    db.delete(post)
    db.commit()


# ─── Likes ───────────────────────────────────────────────────────

@app.post("/api/posts/{post_id}/like")
def toggle_like(
    post_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    post = db.query(models.Post).filter(models.Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    existing = db.query(models.Like).filter(
        models.Like.post_id == post_id, models.Like.user_id == current_user.id
    ).first()
    if existing:
        db.delete(existing)
        db.commit()
        return {"liked": False}

    db.add(models.Like(post_id=post_id, user_id=current_user.id))
    if post.author_id != current_user.id:
        _create_notification(db, post.author_id, "like",
                             f"{current_user.name} liked your post.", related_id=post_id)
    db.commit()
    return {"liked": True}


# ─── Saves ───────────────────────────────────────────────────────

@app.post("/api/posts/{post_id}/save")
def toggle_save(
    post_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    post = db.query(models.Post).filter(models.Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    existing = db.query(models.Save).filter(
        models.Save.post_id == post_id, models.Save.user_id == current_user.id
    ).first()
    if existing:
        db.delete(existing)
        db.commit()
        return {"saved": False}

    db.add(models.Save(post_id=post_id, user_id=current_user.id))
    db.commit()
    return {"saved": True}


@app.get("/api/saved-posts", response_model=list[schemas.PostOut])
def get_saved_posts(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    saves = db.query(models.Save).filter(models.Save.user_id == current_user.id).all()
    post_ids = [s.post_id for s in saves]
    posts = db.query(models.Post).filter(models.Post.id.in_(post_ids)).all()
    return [_enrich_post(p, current_user.id, db) for p in posts]


# ─── Comments ────────────────────────────────────────────────────

@app.get("/api/posts/{post_id}/comments")
def get_comments(post_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    return _get_comments(post_id, db)


@app.post("/api/posts/{post_id}/comments")
def add_comment(
    post_id: int,
    payload: schemas.CommentCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    post = db.query(models.Post).filter(models.Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    comment = models.Comment(
        text=payload.text,
        post_id=post_id,
        author_id=current_user.id,
    )
    db.add(comment)
    if post.author_id != current_user.id:
        _create_notification(db, post.author_id, "comment",
                             f"{current_user.name} commented on your post.", related_id=post_id)
    db.commit()
    return _get_comments(post_id, db)


@app.delete("/api/posts/{post_id}/comments/{comment_id}")
def delete_comment(
    post_id: int,
    comment_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    comment = db.query(models.Comment).filter(
        models.Comment.id == comment_id,
        models.Comment.post_id == post_id,
        models.Comment.author_id == current_user.id,
    ).first()
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    db.delete(comment)
    db.commit()
    return _get_comments(post_id, db)


# ═══════════════════════════ SWIPE / MATCHES ═════════════════════

@app.post("/api/matches/swipe")
def swipe(
    payload: schemas.SwipeAction,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    pet = db.query(models.Pet).filter(models.Pet.id == payload.petId).first()
    if not pet:
        raise HTTPException(status_code=404, detail="Pet not found")

    existing = db.query(models.Swipe).filter(
        models.Swipe.swiper_id == current_user.id,        # updated column name
        models.Swipe.pet_id == payload.petId,
    ).first()
    if not existing:
        db.add(models.Swipe(
            swiper_id=current_user.id,                    # updated column name
            pet_id=payload.petId,
            direction=payload.direction,
        ))
        db.commit()

    is_match = False
    if payload.direction == "like":
        other_user_id = pet.owner_id
        my_pets = db.query(models.Pet).filter(models.Pet.owner_id == current_user.id).all()
        my_pet_ids = [p.id for p in my_pets]

        reverse_swipe = db.query(models.Swipe).filter(
            models.Swipe.swiper_id == other_user_id,      # updated column name
            models.Swipe.pet_id.in_(my_pet_ids),
            models.Swipe.direction == "like",
        ).first()

        if reverse_swipe:
            is_match = True
            # Record the match
            already_matched = db.query(models.Match).filter(
                ((models.Match.user1_id == current_user.id) & (models.Match.user2_id == other_user_id)) |
                ((models.Match.user1_id == other_user_id) & (models.Match.user2_id == current_user.id))
            ).first()
            if not already_matched:
                match = models.Match(
                    user1_id=current_user.id,
                    user2_id=other_user_id,
                    pet1_id=reverse_swipe.pet_id,
                    pet2_id=payload.petId,
                )
                db.add(match)
                _create_notification(db, other_user_id, "match",
                                     f"You matched with {current_user.name}!", related_id=payload.petId)
                _create_notification(db, current_user.id, "match",
                                     f"You matched with {db.query(models.User).filter(models.User.id == other_user_id).first().name}!",
                                     related_id=reverse_swipe.pet_id)
                db.commit()

    return {"match": is_match, "direction": payload.direction}


@app.get("/api/matches")
def get_matches(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    matches = db.query(models.Match).filter(
        (models.Match.user1_id == current_user.id) | (models.Match.user2_id == current_user.id)
    ).all()
    result = []
    for m in matches:
        other_id = m.user2_id if m.user1_id == current_user.id else m.user1_id
        other = db.query(models.User).filter(models.User.id == other_id).first()
        result.append({
            "matchId": m.id,
            "userId": other.id,
            "userName": other.name,
            "userAvatar": other.profile_picture or "",
            "createdAt": m.created_at.isoformat(),
        })
    return result


# ═══════════════════════════ MESSAGING ═══════════════════════════

@app.get("/api/conversations")
def get_conversations(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Derives conversation threads from the messages table directly,
    matching the flat schema (sender_id / receiver_id).
    """
    from sqlalchemy import or_, func

    # Find all distinct peers the current user has messaged with
    sent = db.query(models.Message.receiver_id.label("peer_id")).filter(
        models.Message.sender_id == current_user.id
    )
    received = db.query(models.Message.sender_id.label("peer_id")).filter(
        models.Message.receiver_id == current_user.id
    )
    peer_ids = {row.peer_id for row in sent.union(received).all()}

    result = []
    for peer_id in peer_ids:
        peer = db.query(models.User).filter(models.User.id == peer_id).first()
        if not peer:
            continue
        last_msg = (
            db.query(models.Message)
            .filter(
                or_(
                    (models.Message.sender_id == current_user.id) & (models.Message.receiver_id == peer_id),
                    (models.Message.sender_id == peer_id) & (models.Message.receiver_id == current_user.id),
                )
            )
            .order_by(models.Message.created_at.desc())
            .first()
        )
        unread = db.query(models.Message).filter(
            models.Message.sender_id == peer_id,
            models.Message.receiver_id == current_user.id,
            models.Message.read == False,
        ).count()
        result.append({
            "userId": peer.id,
            "userName": peer.name,
            "userAvatar": peer.profile_picture or "",
            "lastMessage": last_msg.text if last_msg else "",
            "lastMessageTime": last_msg.created_at.isoformat() if last_msg else "",
            "unreadCount": unread,
        })
    return result


@app.get("/api/messages/{user_id}")
def get_messages(
    user_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from sqlalchemy import or_
    msgs = (
        db.query(models.Message)
        .filter(
            or_(
                (models.Message.sender_id == current_user.id) & (models.Message.receiver_id == user_id),
                (models.Message.sender_id == user_id) & (models.Message.receiver_id == current_user.id),
            )
        )
        .order_by(models.Message.created_at.asc())
        .all()
    )
    return [
        {
            "id": m.id,
            "senderId": m.sender_id,
            "receiverId": m.receiver_id,
            "text": m.text or "",
            "image": m.image or "",
            "createdAt": m.created_at.isoformat(),
            "read": m.read,
        }
        for m in msgs
    ]


@app.post("/api/messages", status_code=201)
def send_message(
    payload: schemas.MessageCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    receiver = db.query(models.User).filter(models.User.id == payload.to).first()
    if not receiver:
        raise HTTPException(status_code=404, detail="Recipient not found")

    msg = models.Message(
        sender_id=current_user.id,
        receiver_id=payload.to,
        text=payload.text or "",
        image=payload.image or "",
    )
    db.add(msg)
    _create_notification(db, payload.to, "message",
                         f"New message from {current_user.name}.", related_id=current_user.id)
    db.commit()
    db.refresh(msg)
    return {
        "id": msg.id,
        "senderId": msg.sender_id,
        "receiverId": msg.receiver_id,
        "text": msg.text,
        "image": msg.image,
        "createdAt": msg.created_at.isoformat(),
    }


@app.post("/api/messages/{user_id}/read")
def mark_read(
    user_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    db.query(models.Message).filter(
        models.Message.sender_id == user_id,
        models.Message.receiver_id == current_user.id,
    ).update({"read": True})
    db.commit()
    return {"ok": True}


# ═══════════════════════════ CONNECTIONS ═════════════════════════

@app.get("/api/connections")
def get_connections(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    conns = db.query(models.Connection).filter(
        models.Connection.user_id == current_user.id,
        models.Connection.status == "active",
    ).all()
    result = []
    for c in conns:
        peer = db.query(models.User).filter(models.User.id == c.connected_user_id).first()
        if peer:
            result.append({
                "id": c.id,
                "userId": peer.id,
                "name": peer.name,
                "profilePicture": peer.profile_picture or "",
                "status": c.status,
            })
    return result


@app.post("/api/connections/{user_id}", status_code=201)
def add_connection(
    user_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot connect to yourself")
    peer = db.query(models.User).filter(models.User.id == user_id).first()
    if not peer:
        raise HTTPException(status_code=404, detail="User not found")
    existing = db.query(models.Connection).filter(
        models.Connection.user_id == current_user.id,
        models.Connection.connected_user_id == user_id,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Already connected")
    db.add(models.Connection(user_id=current_user.id, connected_user_id=user_id, status="active"))
    _create_notification(db, user_id, "connection",
                         f"{current_user.name} connected with you.", related_id=current_user.id)
    db.commit()
    return {"ok": True}


@app.delete("/api/connections/{user_id}", status_code=204)
def remove_connection(
    user_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    conn = db.query(models.Connection).filter(
        models.Connection.user_id == current_user.id,
        models.Connection.connected_user_id == user_id,
    ).first()
    if not conn:
        raise HTTPException(status_code=404, detail="Connection not found")
    db.delete(conn)
    db.commit()


# ═══════════════════════════ REVIEWS ═════════════════════════════

@app.get("/api/reviews/{user_id}", response_model=list[schemas.ReviewOut])
def get_reviews(user_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    reviews = db.query(models.Review).filter(models.Review.reviewed_user_id == user_id).all()
    result = []
    for r in reviews:
        reviewer = db.query(models.User).filter(models.User.id == r.reviewer_id).first()
        result.append(schemas.ReviewOut(
            id=r.id,
            reviewer_id=r.reviewer_id,
            reviewed_user_id=r.reviewed_user_id,
            rating=r.rating,
            comment=r.comment or "",
            reviewer_name=reviewer.name if reviewer else "Unknown",
            reviewer_picture=reviewer.profile_picture or "" if reviewer else "",
            created_at=r.created_at.isoformat(),
        ))
    return result


@app.post("/api/reviews", response_model=schemas.ReviewOut, status_code=201)
def create_review(
    payload: schemas.ReviewCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if payload.reviewed_user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot review yourself")
    existing = db.query(models.Review).filter(
        models.Review.reviewer_id == current_user.id,
        models.Review.reviewed_user_id == payload.reviewed_user_id,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="You have already reviewed this user")
    review = models.Review(
        reviewer_id=current_user.id,
        reviewed_user_id=payload.reviewed_user_id,
        rating=payload.rating,
        comment=payload.comment or "",
    )
    db.add(review)
    _create_notification(db, payload.reviewed_user_id, "review",
                         f"{current_user.name} left you a {payload.rating}-star review.",
                         related_id=current_user.id)
    db.commit()
    db.refresh(review)
    return schemas.ReviewOut(
        id=review.id,
        reviewer_id=review.reviewer_id,
        reviewed_user_id=review.reviewed_user_id,
        rating=review.rating,
        comment=review.comment,
        reviewer_name=current_user.name,
        reviewer_picture=current_user.profile_picture or "",
        created_at=review.created_at.isoformat(),
    )


# ═══════════════════════════ NOTIFICATIONS ═══════════════════════

@app.get("/api/notifications", response_model=list[schemas.NotificationOut])
def get_notifications(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    notifs = (
        db.query(models.Notification)
        .filter(models.Notification.user_id == current_user.id)
        .order_by(models.Notification.created_at.desc())
        .limit(50)
        .all()
    )
    return [
        schemas.NotificationOut(
            id=n.id,
            type=n.type,
            message=n.message,
            related_id=n.related_id,
            read=n.read,
            created_at=n.created_at.isoformat(),
        )
        for n in notifs
    ]


@app.post("/api/notifications/read-all")
def mark_all_notifications_read(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    db.query(models.Notification).filter(
        models.Notification.user_id == current_user.id,
        models.Notification.read == False,
    ).update({"read": True})
    db.commit()
    return {"ok": True}


# ═══════════════════════════ FILE UPLOAD ════════════════════════

@app.post("/api/upload")
async def upload_file(
    file: UploadFile = File(...),
    current_user: models.User = Depends(get_current_user),
):
    """
    In production: upload to S3/Cloudinary and return the URL.
    For development, returns a base64 data URL.
    """
    import base64
    contents = await file.read()
    b64 = base64.b64encode(contents).decode()
    data_url = f"data:{file.content_type};base64,{b64}"
    return {"url": data_url}


# ═══════════════════════════ INTERNAL HELPERS ════════════════════

def _get_avg_rating(user_id: int, db: Session) -> float:
    reviews = db.query(models.Review).filter(models.Review.reviewed_user_id == user_id).all()
    if not reviews:
        return 0.0
    return sum(r.rating for r in reviews) / len(reviews)


def _get_comments(post_id: int, db: Session):
    comments = (
        db.query(models.Comment)
        .filter(models.Comment.post_id == post_id)
        .order_by(models.Comment.created_at.asc())
        .all()
    )
    result = []
    for c in comments:
        author = db.query(models.User).filter(models.User.id == c.author_id).first()
        result.append({
            "id": c.id,
            "text": c.text,
            "author": {
                "name": author.name if author else "Unknown",
                "profilePicture": author.profile_picture if author else "",
            },
            "authorImg": author.profile_picture if author else "",
        })
    return result


def _enrich_post(post: models.Post, current_user_id: int, db: Session):
    author = db.query(models.User).filter(models.User.id == post.author_id).first()
    like_count = db.query(models.Like).filter(models.Like.post_id == post.id).count()
    user_liked = db.query(models.Like).filter(
        models.Like.post_id == post.id, models.Like.user_id == current_user_id
    ).first() is not None
    user_saved = db.query(models.Save).filter(
        models.Save.post_id == post.id, models.Save.user_id == current_user_id
    ).first() is not None
    comments = _get_comments(post.id, db)
    return {
        "id": post.id,
        "text": post.text,
        "images": post.images or ([post.image] if post.image else []),
        "createdAt": post.created_at.isoformat(),
        "author": {
            "name": author.name if author else "Unknown",
            "profilePicture": author.profile_picture if author else "",
        },
        "authorImg": author.profile_picture if author else "",
        "likes": [{}] * like_count,
        "liked": user_liked,
        "saved": user_saved,
        "comments": comments,
    }


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=3000, reload=True)
