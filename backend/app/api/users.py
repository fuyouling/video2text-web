"""Authentication: register, login, current user."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api._deps import get_current_user
from app.core import security
from app.core.db import get_db
from app.core.errors import conflict, unauthorized
from app.models import User
from app.schemas import TokenOut, UserCreate, UserLogin, UserOut

router = APIRouter(tags=["auth"])


@router.post("/auth/register", response_model=UserOut, status_code=201)
def register(body: UserCreate, db: Session = Depends(get_db)) -> User:
    if db.scalar(select(User).where(User.email == body.email)):
        conflict("An account with this email already exists")
    user = User(email=body.email, paddle_customer_id=None)
    # Store a password hash via a dedicated column-like attribute on the model.
    user.password_hash = security.hash_password(body.password)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/auth/login", response_model=TokenOut)
def login(body: UserLogin, db: Session = Depends(get_db)) -> TokenOut:
    user = db.scalar(select(User).where(User.email == body.email))
    if user is None or not getattr(user, "password_hash", None):
        unauthorized("Invalid email or password")
    if not security.verify_password(body.password, user.password_hash):
        unauthorized("Invalid email or password")
    token = security.create_access_token(sub=str(user.id))
    return TokenOut(access_token=token)


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)) -> User:
    return user
