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
EXPECTED_DATABASE_NAME = os.getenv("FINANCEFLOW_DATABASE_NAME", "FinanceFlow_db").strip()
if DATABASE_URL:
    DATABASE_URL = make_url(DATABASE_URL)
    if DATABASE_URL.drivername in {"postgres", "postgresql"}:
        DATABASE_URL = DATABASE_URL.set(drivername="postgresql+psycopg2")

if DATABASE_URL and DATABASE_URL.database != EXPECTED_DATABASE_NAME:
    raise RuntimeError(
        f"DATABASE_URL must target {EXPECTED_DATABASE_NAME}; refusing to initialize another database"
    )
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
