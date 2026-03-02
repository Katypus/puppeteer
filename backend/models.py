from sqlalchemy import Column, String, Text, Enum, JSON, ForeignKey, TIMESTAMP, Boolean, Integer, CheckConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base
from sqlalchemy.dialects.postgresql import UUID
import uuid
import enum

class VisibilityEnum(enum.Enum):
    private = "private"
    public = "public"

class User(Base):
    __tablename__ = "users"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    personas = relationship("Persona", back_populates="owner")
    created_at = Column(TIMESTAMP, server_default=func.now())

class Persona(Base):
    __tablename__ = "personas"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    owner_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    name = Column(Text, nullable=False)
    description = Column(Text)
    interests = Column(JSON, nullable=False)
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())
    is_public = Column(Boolean, default=False)
    owner = relationship("User", back_populates="personas")
    
    ## DEMOGRAPHIC TRAITS
    age = Column(Integer, CheckConstraint("age >= 0"), nullable=True)
    gender = Column(String(20), nullable=True)
    race = Column(String(50), nullable=True)
    
    ## BROWSING BEHAVIOR TRAITS (1-10 scale)
    # risk tolerance
    risk = Column(Integer, CheckConstraint("risk BETWEEN 1 AND 10"), default=5, nullable=False)  # 1-10 scale for how much risk they're willing to take (e.g. click sketchy links)
    # attention span (focused on one topic vs easily distracted)
    attention = Column(Integer, CheckConstraint("attention BETWEEN 1 AND 10"), default=5, nullable=False)
    # how long p stays on a page/ how much they scroll before leaving
    patience = Column(Integer, CheckConstraint("patience BETWEEN 1 AND 10"), default=5, nullable=False)
    # political spectrum
    politics = Column(Integer, CheckConstraint("politics BETWEEN 1 AND 10"), default=5, nullable=False)  # 1-10 scale for left to right political views
    
