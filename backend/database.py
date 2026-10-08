"""PostgreSQL engine and SQLAlchemy session configuration."""

from pathlib import Path
import os
from typing import Generator

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.engine import make_url
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

load_dotenv(Path(__file__).resolve().parents[1] / ".env")


class Base(DeclarativeBase):
    pass


DATABASE_URL = os.getenv("DATABASE_URL")
if DATABASE_URL and make_url(DATABASE_URL).database != "FinanceFlow_db":
    raise RuntimeError("DATABASE_URL must target FinanceFlow_db; refusing to initialize another database")
engine = (
    create_engine(DATABASE_URL, pool_pre_ping=True)
    if DATABASE_URL
    else None
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False) if engine else None


def get_db() -> Generator[Session, None, None]:
    if SessionLocal is None:
        raise RuntimeError("DATABASE_URL is not configured in the project .env file")
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
