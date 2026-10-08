"""Database-backed dashboard aggregates."""

from collections import Counter
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from models import ExceptionRecord, ReconciliationResult, Transaction


def dashboard_summary(session: Session) -> dict:
    transaction_count = session.scalar(select(func.count()).select_from(Transaction)) or 0
    transaction_total = session.scalar(select(func.coalesce(func.sum(Transaction.amount), 0))) or Decimal("0.00")
    transaction_statuses = dict(session.execute(
        select(Transaction.status, func.count()).group_by(Transaction.status)
    ).all())
    exception_statuses = dict(session.execute(
        select(ExceptionRecord.status, func.count()).group_by(ExceptionRecord.status)
    ).all())
    exception_priorities = dict(session.execute(
        select(ExceptionRecord.priority, func.count()).group_by(ExceptionRecord.priority)
    ).all())
    reconciliation_statuses = dict(session.execute(
        select(ReconciliationResult.status, func.count()).group_by(ReconciliationResult.status)
    ).all())
    return {
        "transactions": {"count": transaction_count, "amount_total": transaction_total, "by_status": transaction_statuses},
        "exceptions": {"count": sum(exception_statuses.values()), "by_status": exception_statuses, "by_priority": exception_priorities},
        "reconciliation": {"count": sum(reconciliation_statuses.values()), "by_status": reconciliation_statuses},
    }
