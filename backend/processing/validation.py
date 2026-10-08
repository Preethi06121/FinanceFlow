"""Deterministic V001-V010 transaction validation rules."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timezone
from decimal import Decimal, InvalidOperation
from typing import Any, Iterable, Mapping

from ingestion.service import VALID_CURRENCIES, VALID_STATUSES

VALID_TRANSACTION_TYPES = {"SALE", "REFUND", "TRANSFER", "ADJUSTMENT"}
RULES = tuple(f"V{i:03d}" for i in range(1, 11))


@dataclass(frozen=True)
class RuleResult:
    rule_id: str
    passed: bool
    message: str


@dataclass(frozen=True)
class TransactionCheck:
    row_number: int
    transaction_reference: str | None
    record: Mapping[str, Any]
    rules: tuple[RuleResult, ...]

    @property
    def failures(self) -> tuple[RuleResult, ...]:
        return tuple(result for result in self.rules if not result.passed)

    @property
    def passed(self) -> bool:
        return not self.failures


def parse_amount(value: Any) -> Decimal | None:
    if value is None or (isinstance(value, str) and not value.strip()):
        return None
    try:
        amount = Decimal(str(value).strip())
    except (InvalidOperation, ValueError, TypeError):
        return None
    return amount if amount.is_finite() else None


def parse_transaction_date(value: Any) -> datetime | None:
    if isinstance(value, datetime):
        return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value
    if isinstance(value, date):
        return datetime(value.year, value.month, value.day, tzinfo=timezone.utc)
    if not isinstance(value, str) or not value.strip():
        return None
    try:
        parsed = datetime.fromisoformat(value.strip().replace("Z", "+00:00"))
    except ValueError:
        return None
    return parsed.replace(tzinfo=timezone.utc) if parsed.tzinfo is None else parsed


def validate_transactions(
    records: Iterable[Mapping[str, Any]],
    *,
    account_ids: Iterable[str],
    customer_ids: Iterable[str],
    account_customers: Mapping[str, str],
    existing_transaction_ids: Iterable[str] = (),
) -> list[TransactionCheck]:
    """Evaluate all ten rules for each source record; duplicate later occurrences fail V007."""
    known_accounts = {str(value) for value in account_ids}
    known_customers = {str(value) for value in customer_ids}
    relationships = {str(account): str(customer) for account, customer in account_customers.items()}
    seen: set[str] = {str(value) for value in existing_transaction_ids}
    checks: list[TransactionCheck] = []

    for row_number, source in enumerate(records, start=2):
        record = dict(source)
        raw_reference = record.get("transaction_id")
        reference = str(raw_reference).strip() if raw_reference is not None and str(raw_reference).strip() else None
        amount = parse_amount(record.get("amount"))
        currency = str(record.get("currency") or "").strip().upper()
        transaction_type = str(record.get("transaction_type") or "").strip().upper()
        transaction_date = parse_transaction_date(record.get("transaction_date"))
        account = str(record.get("account_id") or "").strip()
        customer = str(record.get("customer_id") or "").strip()
        status = str(record.get("status") or "").strip().lower()

        account_exists = account in known_accounts
        customer_exists = customer in known_customers
        relationship_valid = (
            account_exists and customer_exists and relationships.get(account) == customer
        )
        duplicate = bool(reference and reference in seen)
        if reference:
            seen.add(reference)

        results = (
            RuleResult("V001", bool(reference), "Transaction ID is required"),
            RuleResult("V002", amount is not None and amount > 0, "Amount must be a positive decimal"),
            RuleResult("V003", currency in VALID_CURRENCIES, "Currency is not supported"),
            RuleResult("V004", transaction_type in VALID_TRANSACTION_TYPES, "Transaction type is not supported"),
            RuleResult("V005", transaction_date is not None, "Transaction date is invalid"),
            RuleResult("V006", account_exists, "Account does not exist"),
            RuleResult("V007", not duplicate, "Duplicate transaction ID"),
            RuleResult("V008", customer_exists, "Customer does not exist"),
            RuleResult("V009", status in VALID_STATUSES, "Transaction status is not supported"),
            RuleResult("V010", relationship_valid or not (account_exists and customer_exists), "Account does not belong to the supplied customer"),
        )
        checks.append(TransactionCheck(row_number, reference, record, results))
    return checks
