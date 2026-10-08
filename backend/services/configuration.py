"""Administrator-managed JSON application configuration."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from models import AppConfig


def list_config(session: Session) -> list[AppConfig]:
    return list(session.scalars(select(AppConfig).order_by(AppConfig.key)))


def set_config(session: Session, key: str, value, user_id: int) -> AppConfig:
    key = key.strip()
    if not key or len(key) > 100:
        raise ValueError("Configuration key must contain 1 to 100 characters")
    setting = session.get(AppConfig, key)
    if setting is None:
        setting = AppConfig(key=key, value=value, updated_by=user_id)
        session.add(setting)
    else:
        setting.value = value
        setting.updated_by = user_id
    session.flush()
    return setting
