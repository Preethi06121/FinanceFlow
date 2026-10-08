"""User administration workflows."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from models import User
from security.auth import hash_password


def create_user(session: Session, *, email: str, full_name: str, password: str, role: str = "ANALYST") -> User:
    normalized_email = email.strip().lower()
    if session.scalar(select(User.id).where(User.email == normalized_email)) is not None:
        raise ValueError("A user with this email already exists")
    if role not in {"ANALYST", "ADMIN"}:
        raise ValueError("Role must be ANALYST or ADMIN")
    user = User(
        email=normalized_email,
        full_name=full_name.strip(),
        password_hash=hash_password(password),
        role=role,
        is_active=True,
    )
    session.add(user)
    session.flush()
    return user


def update_user(session: Session, user_id: int, updates: dict) -> User:
    user = session.get(User, user_id)
    if user is None:
        raise LookupError("User not found")
    if not updates or not any(value is not None for value in updates.values()):
        raise ValueError("At least one user field must be updated")
    if user.role == "ADMIN" and (updates.get("role") == "ANALYST" or updates.get("is_active") is False):
        active_admins = session.scalars(select(User).where(User.role == "ADMIN", User.is_active.is_(True))).all()
        if user.is_active and len(active_admins) <= 1:
            raise ValueError("The last active administrator cannot be demoted or deactivated")
    if updates.get("password"):
        user.password_hash = hash_password(updates.pop("password"))
    for key, value in updates.items():
        if value is not None:
            setattr(user, key, value)
    session.flush()
    return user


def list_users(session: Session, *, offset: int, limit: int) -> list[User]:
    return list(session.scalars(select(User).order_by(User.id).offset(offset).limit(limit)))
