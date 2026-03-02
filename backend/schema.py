# -----------------------
# Request Models
# -----------------------
from uuid import UUID
from pydantic.v1 import BaseModel
from pydantic import BaseModel, Field
from typing import List, Literal
from datetime import datetime

class PersonaPost(BaseModel):
    name: str
    interests: List[str]
    description: str = ""
    is_public: bool = False
    ## DEMOGRAPHIC TRAITS
    age: int = Field(default=30, ge=0)
    gender: str = "unspecified"
    race: str = "unspecified"
    ## POLITICAL INDEX (0 is left, 10 is right)
    politics: float = Field(default=5, ge=0, le=10)
    
    # BROWSING BEHAVIOR TRAITS (1-10 scale)
    risk: float = Field(default=5, ge=0, le=10)
    attention: float = Field(default=5, ge=0, le=10)
    patience: float = Field(default=5, ge=0, le=10)

class PersonaGet(BaseModel):
    id: UUID
    owner_id: UUID
    created_at: datetime
    updated_at: datetime
    # Same as Persona but with additional metadata fields from the database. Used for API responses.
    name: str
    interests: List[str]
    description: str = ""
    is_public: bool = False
    ## DEMOGRAPHIC TRAITS
    age: int = Field(default=30, ge=0)
    gender: str = "unspecified"
    race: str = "unspecified"
    ## POLITICAL INDEX (0 is left, 10 is right)
    political_index: float = Field(default=5, ge=0, le=10)
    
    # BROWSING BEHAVIOR TRAITS (1-10 scale)
    risk: float = Field(default=5, ge=0, le=10)
    attention: float = Field(default=5, ge=0, le=10)
    patience: float = Field(default=5, ge=0, le=10)

class PageSummary(BaseModel):
    url: str
    title: str
    links: List[str]

class DecideRequest(BaseModel):
    persona: PersonaPost
    page: PageSummary


# -----------------------
# Response Model
# -----------------------

class Decision(BaseModel):
    action: Literal["click", "search", "idle"]
    target: str | None = None
    reason: str