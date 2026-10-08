"""Exception creation and guarded lifecycle transitions."""

from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from typing import Iterable, Mapping

from sqlalchemy import select
from sqlalchemy.orm import Session

from models import ExceptionRecord
from processing.audit import record_exception_status_change
from processing.reconciliation import ReconciliationCheck
from processing.validation import TransactionCheck, parse_amount

PRIORITIES = {"LOW", "MEDIUM", "HIGH", "CRITICAL"}
NEXT_STATUS = {"OPEN": "UNDER_REVIEW", "UNDER_REVIEW": "RESOLVED"}
RULE_PRIORITIES = {
    "V001": "HIGH",
    "V002": "HIGH",
    "V003": "MEDIUM",
    "V004": "MEDIUM",
    "V005": "MEDIUM",
    "V006": "CRITICAL",
    "V007": "HIGH",
    "V008": "HIGH",
    "V009": "MEDIUM",
    "V010": "CRITICAL",
}


def create_exception(
    session: Session,
    *,
    exception_type: str,
    reason: str,
    priority: str,
    transaction_id: int | None = None,
    customer_id: int | None = None,
    transaction_reference: str | None = None,
    source_amount: Decimal | None = None,
    ledger_amount: Decimal | None = None,
    difference: Decimal | None = None,
    source_key: str | None = None,
) -> ExceptionRecord:
    priority = priority.upper()
    if priority not in PRIORITIES:
        raise ValueError(f"Unsupported exception priority: {priority}")
    if not reason.strip():
        raise ValueError("Exception reason is required")
    if source_key:
        existing_id = session.scalar(select(ExceptionRecord.id).where(ExceptionRecord.source_key == source_key))
        if existing_id is not None:
            return session.get(ExceptionRecord, existing_id)
    record = ExceptionRecord(
        transaction_id=transaction_id,
        customer_id=customer_id,
        transaction_reference=transaction_reference,
        source_key=source_key,
        exception_type=exception_type,
        source_amount=source_amount,
        ledger_amount=ledger_amount,
        difference=difference,
        priority=priority,
        severity=priority.lower(),
        status="OPEN",
        reason=reason,
        description=reason,
    )
    session.add(record)
    session.flush()
    return record


def create_processing_exceptions(
    session: Session,
    validation_checks: Iterable[TransactionCheck],
    reconciliation_checks: Iterable[ReconciliationCheck],
    *,
    transaction_ids: Mapping[str, int],
    customer_ids: Mapping[str, int],
) -> int:
    created = 0
    for check in validation_checks:
        amount = parse_amount(check.record.get("amount"))
        reference = check.transaction_reference
        customer_ref = check.record.get("customer_id")
        customer_id = customer_ids.get(str(customer_ref)) if customer_ref else None
        for failure in check.failures:
            key = f"validation:{reference or 'missing'}:{check.row_number}:{failure.rule_id}"
            existed = session.scalar(select(ExceptionRecord.id).where(ExceptionRecord.source_key == key))
            if existed:
                continue
            create_exception(
                session,
                exception_type=failure.rule_id,
                reason=failure.message,
                priority=RULE_PRIORITIES[failure.rule_id],
                transaction_id=transaction_ids.get(reference) if reference else None,
                customer_id=customer_id,
                transaction_reference=reference,
                source_amount=amount,
                source_key=key,
            )
            created += 1

    for check in reconciliation_checks:
        if check.status == "MATCHED":
            continue
        key = f"reconciliation:{check.transaction_reference}:{check.status}"
        existed = session.scalar(select(ExceptionRecord.id).where(ExceptionRecord.source_key == key))
        if existed:
            continue
        priority = "CRITICAL" if check.status in {"MISSING_LEDGER", "MISSING_SOURCE"} else "HIGH"
        create_exception(
            session,
            exception_type=check.status,
            reason=check.reason,
            priority=priority,
            transaction_id=transaction_ids.get(check.transaction_reference),
            transaction_reference=check.transaction_reference,
            source_amount=check.source_amount,
            ledger_amount=check.ledger_amount,
            difference=check.difference,
            source_key=key,
        )
        created += 1
    return created


def transition_exception(
    session: Session,
    exception_id: int,
    new_status: str,
    *,
    resolution_reason: str | None = None,
    user_id: int | None = None,
) -> ExceptionRecord:
    exception = session.scalar(
        select(ExceptionRecord).where(ExceptionRecord.id == exception_id).with_for_update()
    )
    if exception is None:
        raise LookupError(f"Exception {exception_id} does not exist")
    new_status = new_status.upper()
    expected = NEXT_STATUS.get(exception.status)
    if new_status != expected:
        raise ValueError(f"Invalid exception transition: {exception.status} -> {new_status}")
    if new_status == "RESOLVED" and not (resolution_reason and resolution_reason.strip()):
        raise ValueError("Resolution reason is required to resolve an exception")

    old_status = exception.status
    exception.status = new_status
    if new_status == "RESOLVED":
        exception.resolution_reason = resolution_reason.strip()
        exception.resolved_at = datetime.now(timezone.utc)
    record_exception_status_change(
        session,
        exception,
        old_status=old_status,
        new_status=new_status,
        user_id=user_id,
        reason=resolution_reason,
    )
    session.flush()
    return exception
