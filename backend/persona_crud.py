# create/list/publish personas
from db import SessionLocal
from models import Persona

def create_persona(user_id, name, description, persona_json, is_public, risk, attention, patience, 
                    politics, gender, age, race):
    session = SessionLocal()
    persona = Persona(
        owner_id=user_id,
        name=name,
        description=description,
        persona_json=persona_json,
        is_public=is_public,
        risk = risk,
        attention = attention,
        patience = patience,
        politics = politics,
        gender = gender,
        age = age,
        race = race
        )
    session.add(persona)
    session.commit()
    session.refresh(persona)
    session.close()
    return persona

def list_private_personas(user_id):
    session = SessionLocal()
    personas = session.query(Persona).filter_by(owner_id=user_id).all()
    session.close()
    return personas

def list_public_personas():
    session = SessionLocal()
    personas = session.query(Persona).filter_by(is_public=True).all()
    session.close()
    return personas
