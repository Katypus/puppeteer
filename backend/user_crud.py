# user_crud.py
from sqlalchemy.orm import Session
from uuid import UUID
from models import User

def get_or_create_user(db: Session, user_id: UUID) -> User:
    user = db.query(User).filter(User.id == user_id).first()
    if user:
        return user

    user = User(id=user_id)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user