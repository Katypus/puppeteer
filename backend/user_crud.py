# user_crud.py
from sqlalchemy.orm import Session
from uuid import UUID
from backend.models import User

from sqlalchemy.dialects.postgresql import insert as pg_insert

def get_or_create_user(db: Session, user_id: UUID) -> User:
    stmt = pg_insert(User).values(id=user_id).on_conflict_do_nothing(index_elements=["id"])
    db.execute(stmt)
    db.commit()
    
    return db.query(User).filter(User.id == user_id).first()