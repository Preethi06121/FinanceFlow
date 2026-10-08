"""Read-side service functions for persisted reconciliation results."""

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from models import ReconciliationResult


def list_results(session: Session, *, offset: int, limit: int, result_status: str | None = None):
    query = select(ReconciliationResult)
    count_query = select(func.count()).select_from(ReconciliationResult)
    if result_status:
        query = query.where(ReconciliationResult.status == result_status.upper())
        count_query = count_query.where(ReconciliationResult.status == result_status.upper())
    rows = list(session.scalars(query.order_by(ReconciliationResult.id).offset(offset).limit(limit)))
    return rows, session.scalar(count_query) or 0
