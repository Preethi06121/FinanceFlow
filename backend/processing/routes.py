"""Thin HTTP endpoints delegating to processing services."""

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models import ExceptionRecord
from processing.exceptions import transition_exception
from processing.pipeline import run_processing
from security.dependencies import require_roles
from models import User

router = APIRouter()


class ExceptionTransitionRequest(BaseModel):
    status: Literal["UNDER_REVIEW", "RESOLVED"]
    resolution_reason: str | None = None


@router.post("/processing/run")
def process_synthetic_dataset(
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("ANALYST", "ADMIN")),
):
    try:
        return run_processing(db)
    except Exception as exc:
        db.rollback()
        if isinstance(exc, (RuntimeError, FileNotFoundError)):
            raise HTTPException(status_code=503, detail=str(exc)) from None
        raise


@router.patch("/exceptions/{exception_id}/status")
def update_exception_status(
    exception_id: int,
    request: ExceptionTransitionRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("ANALYST", "ADMIN")),
):
    try:
        exception: ExceptionRecord = transition_exception(
            db,
            exception_id,
            request.status,
            resolution_reason=request.resolution_reason,
            user_id=user.id,
        )
        db.commit()
        db.refresh(exception)
    except LookupError as exc:
        db.rollback()
        raise HTTPException(status_code=404, detail=str(exc)) from None
    except ValueError as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(exc)) from None
    return {
        "id": exception.id,
        "status": exception.status,
        "resolution_reason": exception.resolution_reason,
        "updated_at": exception.updated_at,
    }
