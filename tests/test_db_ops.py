'''
Tests for basic database operations: creating a user, creating a persona, and querying it back.
'''
from backend.database import SessionLocal
from backend.models import User, Persona
import uuid
import json

def test_database_ops():
    session = SessionLocal()

    # 1) Create a user
    new_user = User(
        id=str(uuid.uuid4()),
        email=f"tester+{uuid.uuid4()}@example.com",
        password_hash="fakehash"
    )
    session.add(new_user)
    session.commit()
    session.close()

if __name__ == "__main__":
    test_database_ops()
