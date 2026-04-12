import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))

# create/list/publish personas
from requests import Session
from sqlalchemy import or_

from database import SessionLocal
from models import Persona

def create_persona(database: Session, user_id, persona_data: dict):
    persona = Persona(
        owner_id=user_id,
        **persona_data
    )

    database.add(persona)
    database.commit()
    database.refresh(persona)

    return persona

def list_private_personas(database: Session, user_id):
    personas = database.query(Persona).filter_by(owner_id=user_id).all()
    return personas

def list_public_personas(database: Session):
    personas = database.query(Persona).filter_by(is_public=True).all()
    return personas

def list_accessible_personas(database: Session, user_id):
    personas = database.query(Persona).filter(
        or_(
            Persona.is_public == True,
            Persona.owner_id == user_id
        )
    ).all()
    return personas