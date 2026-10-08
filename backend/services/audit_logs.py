"""Read-side audit log queries."""

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from models import AuditLog


def list_audit_logs(session: Session, *, offset: int, limit: int, entity_type: str | None = None):
    query = select(AuditLog)
    count_query = select(func.count()).select_from(AuditLog)
    if entity_type:
        query = query.where(AuditLog.entity_type == entity_type)
        count_query = count_query.where(AuditLog.entity_type == entity_type)
    rows = list(session.scalars(query.order_by(AuditLog.created_at.desc(), AuditLog.id.desc()).offset(offset).limit(limit)))
    return rows, session.scalar(count_query) or 0
