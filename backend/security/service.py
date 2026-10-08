"""Authentication workflows independent of API route functions."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from api.schemas import LoginResponse
from models import User
from security.auth import create_access_token, verify_password


def authenticate(session: Session, email: str, password: str) -> LoginResponse | None:
    user = session.scalar(select(User).where(User.email == email.strip().lower()))
    if user is None or not user.is_active or not verify_password(password, user.password_hash):
        return None
    token, expires_in = create_access_token(user.id, user.role)
    return LoginResponse(
        access_token=token,
        expires_in=expires_in,
        user_id=user.id,
        email=user.email,
        role=user.role,
    )
