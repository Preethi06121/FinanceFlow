"""Audit entry creation for exception lifecycle changes."""

from sqlalchemy.orm import Session

from models import AuditLog, ExceptionRecord


def record_exception_status_change(
    session: Session,
    exception: ExceptionRecord,
    *,
    old_status: str,
    new_status: str,
    user_id: int | None = None,
    reason: str | None = None,
) -> AuditLog:
    entry = AuditLog(
        user_id=user_id,
        action="status_changed",
        entity_type="exception",
        entity_id=str(exception.id),
        details={"from": old_status, "to": new_status, "reason": reason},
    )
    session.add(entry)
    return entry
