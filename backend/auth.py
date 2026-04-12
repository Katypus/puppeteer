import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))

# auth.py
from fastapi import Header, HTTPException, Depends
from sqlalchemy.orm import Session
from uuid import UUID

from database import SessionLocal
from user_crud import get_or_create_user

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_current_user(
    x_user_id: str = Header(..., alias="X-User-Id"),
    db: Session = Depends(get_db),
):
    try:
        user_id = UUID(x_user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid X-User-Id")

    return get_or_create_user(db, user_id)