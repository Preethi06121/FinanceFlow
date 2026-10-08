"""Read-side service functions for persisted processing exceptions."""

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from models import ExceptionRecord


def list_exceptions(
    session: Session,
    *,
    offset: int,
    limit: int,
    status: str | None = None,
    priority: str | None = None,
):
    query = select(ExceptionRecord)
    count_query = select(func.count()).select_from(ExceptionRecord)
    if status:
        query = query.where(ExceptionRecord.status == status.upper())
        count_query = count_query.where(ExceptionRecord.status == status.upper())
    if priority:
        query = query.where(ExceptionRecord.priority == priority.upper())
        count_query = count_query.where(ExceptionRecord.priority == priority.upper())
    rows = list(session.scalars(query.order_by(ExceptionRecord.created_at.desc(), ExceptionRecord.id.desc()).offset(offset).limit(limit)))
    return rows, session.scalar(count_query) or 0


def get_exception(session: Session, exception_id: int) -> ExceptionRecord | None:
    return session.get(ExceptionRecord, exception_id)
