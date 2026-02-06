from sqlalchemy import Column, String, Text, Enum, JSON, ForeignKey, TIMESTAMP, Boolean, Integer
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from db import Base
from sqlalchemy.dialects.postgresql import UUID
import uuid
import enum

class VisibilityEnum(enum.Enum):
    private = "private"
    public = "public"

class User(Base):
    __tablename__ = "users"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(Text, unique=True, nullable=False)
    password_hash = Column(Text, nullable=False)

    personas = relationship("Persona", back_populates="owner")

class Persona(Base):
    __tablename__ = "personas"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    owner_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    name = Column(Text, nullable=False)
    description = Column(Text)
    persona_json = Column(JSON, nullable=False)
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())
    is_public = Column(Boolean, default=False)

    owner = relationship("User", back_populates="personas")
