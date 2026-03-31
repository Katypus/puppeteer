from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List
from uuid import UUID
from backend.models import User
from backend.database import SessionLocal, get_database
import backend.persona_crud
from backend.auth import get_current_user
from backend.schema import PersonaPost, PersonaGet

router = APIRouter(prefix="/personas")

@router.get("/", response_model=List[PersonaGet])
def get_accessible_personas(
    database: Session = Depends(get_database),
    current_user = Depends(get_current_user)
):
    return persona_crud.list_accessible_personas(
        database,
        current_user.id
    )
    
@router.get("/public", response_model=List[PersonaGet])
def get_public_personas(
    database: Session = Depends(get_database)
):
    return persona_crud.list_public_personas(database)

@router.get("/mine", response_model=List[PersonaGet])
def get_my_personas(
    database: Session = Depends(get_database),
    current_user = Depends(get_current_user)
):
    return persona_crud.list_private_personas(
        database,
        current_user.id
    )
    
@router.post("/", response_model=PersonaPost)
def create_persona_route(
    payload: PersonaPost,   # whatever your Pydantic model is
    database: Session = Depends(get_database),
    user_id: User = Depends(get_current_user),
):
    persona_data = payload.model_dump()  # pydantic v2
    # OR payload.dict() for pydantic v1

    return persona_crud.create_persona(
        database=database,
        user_id=user_id.id,
        persona_data=persona_data,
    )