'''
Tests for basic database operations: creating a user, creating a persona, and querying it back.
'''
from db import SessionLocal
from models import User, Persona
import uuid
import json

def test_database_ops():
    session = SessionLocal()

    # 1) Create a user
    new_user = User(
        id=str(uuid.uuid4()),
        email="tester@example.com",
        password_hash="fakehash"
    )
    session.add(new_user)
    session.commit()

    # 2) Create a persona
    new_persona = Persona(
        id=str(uuid.uuid4()),
        owner_user_id=new_user.id,
        name="Test Persona",
        description="A test persona.",
        persona_json={"interests": ["tech", "music"], "curiosity": 0.7},
        visibility="private"
    )
    session.add(new_persona)
    session.commit()

    # 3) Query it back
    retrieved = session.query(Persona).filter_by(name="Test Persona").first()
    print("Retrieved persona:", retrieved.name, retrieved.persona_json)

    session.close()

if __name__ == "__main__":
    test_database_ops()
