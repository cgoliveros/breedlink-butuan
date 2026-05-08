from sqlalchemy import (
    Column, Integer, BigInteger, String, Boolean, JSON, ForeignKey,
    DateTime, Text, CheckConstraint, UniqueConstraint,
)
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from database import Base


def now():
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id = Column(BigInteger, primary_key=True, index=True)
    name = Column(Text, nullable=False)
    email = Column(Text, unique=True, index=True, nullable=False)
    password_hash = Column(Text, nullable=False)          # renamed from `password`
    account_type = Column(Text, default="breeder")        # breeder, farmer, vet, enthusiast
    phone = Column(Text, default="")
    location = Column(Text, default="Butuan City, Philippines")
    bio = Column(Text, default="")
    profile_picture = Column(Text)
    cover_photo = Column(Text)
    tags = Column(JSON, default=list)
    contact = Column(JSON, default=lambda: {"email": "", "phone": "", "location": "Butuan City, Philippines"})
    stats = Column(JSON, default=lambda: {"connections": 0, "litters": 0, "rating": 4.8})
    verified = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=now)
    updated_at = Column(DateTime(timezone=True), default=now, onupdate=now)

    posts = relationship("Post", back_populates="author", cascade="all, delete-orphan")
    pets = relationship("Pet", back_populates="owner", cascade="all, delete-orphan")
    reviews_given = relationship("Review", foreign_keys="Review.reviewer_id", back_populates="reviewer", cascade="all, delete-orphan")
    reviews_received = relationship("Review", foreign_keys="Review.reviewed_user_id", back_populates="reviewed_user", cascade="all, delete-orphan")
    notifications = relationship("Notification", back_populates="user", cascade="all, delete-orphan")
    connections_as_user = relationship("Connection", foreign_keys="Connection.user_id", back_populates="user", cascade="all, delete-orphan")


class Pet(Base):
    __tablename__ = "pets"

    id = Column(BigInteger, primary_key=True, index=True)
    owner_id = Column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name = Column(Text, nullable=False)
    breed = Column(Text, nullable=False)
    gender = Column(Text, nullable=False)                 # Male or Female
    age = Column(Text)
    status = Column(Text, default="Available")            # Available, Available for Stud, etc.
    image = Column(Text)
    litter_count = Column(Integer, default=0)
    partner = Column(Text, default="None")
    description = Column(Text, default="")
    health_certificates = Column(JSON, default=list)
    health_documents = Column(JSON, default=list)
    category = Column(Text, default="Pet")               # Pet or Livestock
    created_at = Column(DateTime(timezone=True), default=now)
    updated_at = Column(DateTime(timezone=True), default=now, onupdate=now)

    owner = relationship("User", back_populates="pets")


class Post(Base):
    __tablename__ = "posts"

    id = Column(BigInteger, primary_key=True, index=True)
    author_id = Column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    text = Column(Text, default="")
    image = Column(Text)                                  # single image
    images = Column(JSON, default=list)                   # multiple images array
    created_at = Column(DateTime(timezone=True), default=now)
    updated_at = Column(DateTime(timezone=True), default=now, onupdate=now)

    author = relationship("User", back_populates="posts")
    comments = relationship("Comment", back_populates="post", cascade="all, delete-orphan")
    likes = relationship("Like", back_populates="post", cascade="all, delete-orphan")
    saves = relationship("Save", back_populates="post", cascade="all, delete-orphan")


class Like(Base):
    __tablename__ = "post_likes"                          # renamed from `likes`

    id = Column(BigInteger, primary_key=True, index=True)
    post_id = Column(BigInteger, ForeignKey("posts.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime(timezone=True), default=now)

    __table_args__ = (UniqueConstraint("post_id", "user_id"),)

    post = relationship("Post", back_populates="likes")


class Save(Base):
    __tablename__ = "post_saves"                          # renamed from `saves`

    id = Column(BigInteger, primary_key=True, index=True)
    post_id = Column(BigInteger, ForeignKey("posts.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime(timezone=True), default=now)

    __table_args__ = (UniqueConstraint("post_id", "user_id"),)

    post = relationship("Post", back_populates="saves")


class Comment(Base):
    __tablename__ = "post_comments"                       # renamed from `comments`

    id = Column(BigInteger, primary_key=True, index=True)
    post_id = Column(BigInteger, ForeignKey("posts.id", ondelete="CASCADE"), nullable=False)
    author_id = Column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    text = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), default=now)
    updated_at = Column(DateTime(timezone=True), default=now, onupdate=now)

    post = relationship("Post", back_populates="comments")
    author = relationship("User")


class Swipe(Base):
    __tablename__ = "swipes"

    id = Column(BigInteger, primary_key=True, index=True)
    swiper_id = Column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)   # renamed from user_id
    pet_id = Column(BigInteger, ForeignKey("pets.id", ondelete="CASCADE"), nullable=False)
    direction = Column(Text, nullable=False)              # "like" or "dislike"
    created_at = Column(DateTime(timezone=True), default=now)

    __table_args__ = (UniqueConstraint("swiper_id", "pet_id"),)


class Match(Base):
    __tablename__ = "matches"

    id = Column(BigInteger, primary_key=True, index=True)
    user1_id = Column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    user2_id = Column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    pet1_id = Column(BigInteger, ForeignKey("pets.id", ondelete="CASCADE"), nullable=False)
    pet2_id = Column(BigInteger, ForeignKey("pets.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime(timezone=True), default=now)


class Message(Base):
    __tablename__ = "messages"

    id = Column(BigInteger, primary_key=True, index=True)
    sender_id = Column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    receiver_id = Column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)  # replaces conversation_id
    text = Column(Text, default="")
    image = Column(Text)
    read = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=now)


class Connection(Base):
    __tablename__ = "connections"

    id = Column(BigInteger, primary_key=True, index=True)
    user_id = Column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    connected_user_id = Column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    status = Column(Text, default="active")               # active, pending, blocked
    created_at = Column(DateTime(timezone=True), default=now)

    __table_args__ = (UniqueConstraint("user_id", "connected_user_id"),)

    user = relationship("User", foreign_keys=[user_id], back_populates="connections_as_user")


class Review(Base):
    __tablename__ = "reviews"

    id = Column(BigInteger, primary_key=True, index=True)
    reviewer_id = Column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    reviewed_user_id = Column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    rating = Column(Integer, CheckConstraint("rating >= 1 AND rating <= 5"), nullable=False)
    comment = Column(Text, default="")
    created_at = Column(DateTime(timezone=True), default=now)

    __table_args__ = (UniqueConstraint("reviewer_id", "reviewed_user_id"),)

    reviewer = relationship("User", foreign_keys=[reviewer_id], back_populates="reviews_given")
    reviewed_user = relationship("User", foreign_keys=[reviewed_user_id], back_populates="reviews_received")


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(BigInteger, primary_key=True, index=True)
    user_id = Column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    type = Column(Text, nullable=False)                   # like, comment, match, message, connection
    message = Column(Text, nullable=False)
    related_id = Column(BigInteger)
    read = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=now)

    user = relationship("User", back_populates="notifications")
