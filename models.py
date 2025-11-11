from sqlalchemy import Column, String, Text, Enum, JSON, ForeignKey, TIMESTAMP
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from db import Base
import enum

class VisibilityEnum(enum.Enum):
    private = "private"
    public = "public"

class User(Base):
    __tablename__ = "users"
    
    id = Column(String, primary_key=True)
    email = Column(Text, unique=True, nullable=False)
    password_hash = Column(Text, nullable=False)

    personas = relationship("Persona", back_populates="owner")

class Persona(Base):
    __tablename__ = "personas"

    id = Column(String, primary_key=True)
    owner_user_id = Column(String, ForeignKey("users.id"), nullable=False)
    name = Column(Text, nullable=False)
    description = Column(Text)
    persona_json = Column(JSON, nullable=False)
    visibility = Column(Enum(VisibilityEnum), default=VisibilityEnum.private)
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())

    owner = relationship("User", back_populates="personas")
