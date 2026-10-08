"""Validate and normalize sales, payment, and ledger CSV files."""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any, IO, Iterable, Mapping

import pandas as pd


SCHEMAS = {
    "sales": {
        "required": ("transaction_id", "customer_id", "account_id", "transaction_date", "amount", "currency", "status", "transaction_type"),
        "date": "transaction_date",
    },
    "payments": {
        "required": ("payment_id", "transaction_id", "account_id", "payment_date", "amount", "currency", "status"),
        "date": "payment_date",
    },
    "ledger": {
        "required": ("ledger_id", "transaction_id", "account_id", "entry_date", "amount", "currency", "status", "entry_type"),
        "date": "entry_date",
    },
}
VALID_CURRENCIES = {"USD", "EUR", "GBP", "CAD", "INR"}
VALID_STATUSES = {"pending", "posted", "settled", "failed", "reversed"}


@dataclass(frozen=True)
class IngestionIssue:
    code: str
    message: str
    row_number: int | None = None
    column: str | None = None
    value: Any = None


@dataclass
class IngestionResult:
    source_type: str
    source_file: str
    total_rows: int = 0
    accepted_rows: int = 0
    rejected_rows: int = 0
    issues: list[IngestionIssue] = field(default_factory=list)
    records: list[dict[str, Any]] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "source_type": self.source_type,
            "source_file": self.source_file,
            "total_rows": self.total_rows,
            "accepted_rows": self.accepted_rows,
            "rejected_rows": self.rejected_rows,
            "issue_count": len(self.issues),
            "issues": [asdict(issue) for issue in self.issues],
        }


def _is_missing(value: Any) -> bool:
    return value is None or pd.isna(value) or (isinstance(value, str) and not value.strip())


def _as_reference_set(values: Iterable[str] | None) -> set[str] | None:
    return None if values is None else {str(value) for value in values}


def ingest_csv(
    path: str | Path | IO[bytes] | IO[str],
    source_type: str,
    *,
    account_ids: Iterable[str] | None = None,
    customer_ids: Iterable[str] | None = None,
    expected_transaction_ids: Iterable[str] | None = None,
    expected_amounts: Mapping[str, Decimal | str] | None = None,
) -> IngestionResult:
    """Load one supported source CSV and return valid records plus row issues.

    ``account_ids`` and ``customer_ids`` enable reference validation. Supplying
    ``expected_transaction_ids`` for a ledger also reports transactions with
    no corresponding ledger entry. ``expected_amounts`` enables amount
    comparison by transaction ID, commonly when validating a ledger against
    sales or payments.
    """
    source_type = source_type.lower()
    if source_type not in SCHEMAS:
        raise ValueError(f"Unsupported source type: {source_type}")
    file_path = Path(path) if isinstance(path, (str, Path)) else None
    result = IngestionResult(
        source_type=source_type,
        source_file=file_path.name if file_path else Path(getattr(path, "name", "upload.csv")).name,
    )
    try:
        frame = pd.read_csv(file_path if file_path else path, dtype="string", keep_default_na=True)
    except (OSError, pd.errors.ParserError, UnicodeError) as exc:
        result.issues.append(IngestionIssue("file_error", str(exc)))
        return result

    schema = SCHEMAS[source_type]
    missing_columns = [name for name in schema["required"] if name not in frame.columns]
    if missing_columns:
        for column in missing_columns:
            result.issues.append(IngestionIssue("missing_column", f"Required column '{column}' is missing", column=column))
        result.total_rows = len(frame)
        result.rejected_rows = len(frame)
        return result

    result.total_rows = len(frame)
    account_refs = _as_reference_set(account_ids)
    customer_refs = _as_reference_set(customer_ids)
    expected_refs = _as_reference_set(expected_transaction_ids)
    seen_transaction_ids: set[str] = set()
    rejected: set[int] = set()
    normalized: dict[int, dict[str, Any]] = {}
    required = schema["required"]

    def issue(index: int, code: str, message: str, column: str | None = None, value: Any = None) -> None:
        rejected.add(index)
        result.issues.append(IngestionIssue(code, message, row_number=index + 2, column=column, value=None if _is_missing(value) else str(value)))

    for index, row in frame.iterrows():
        record = {key: (None if _is_missing(value) else str(value).strip()) for key, value in row.items()}
        normalized[index] = record
        for column in required:
            if _is_missing(row[column]):
                issue(index, "missing_value", f"Required value for '{column}' is missing", column)

        transaction_id = record.get("transaction_id")
        if transaction_id:
            if transaction_id in seen_transaction_ids:
                issue(index, "duplicate_transaction", "Transaction ID is duplicated in this file", "transaction_id", transaction_id)
            seen_transaction_ids.add(transaction_id)

        date_column = schema["date"]
        if not _is_missing(row[date_column]):
            parsed_date = pd.to_datetime(row[date_column], errors="coerce", utc=True)
            if pd.isna(parsed_date):
                issue(index, "invalid_date", f"'{date_column}' is not a valid date", date_column, row[date_column])
            else:
                record[date_column] = parsed_date.isoformat()

        amount = row["amount"]
        if not _is_missing(amount):
            try:
                parsed_amount = Decimal(str(amount).strip())
                if not parsed_amount.is_finite() or parsed_amount <= 0:
                    raise InvalidOperation
                record["amount"] = parsed_amount
                expected_amount = (expected_amounts or {}).get(transaction_id) if transaction_id else None
                if expected_amount is not None and parsed_amount != Decimal(str(expected_amount)):
                    issue(index, "amount_mismatch", "Amount differs from the supplied transaction amount", "amount", amount)
            except (InvalidOperation, ValueError):
                issue(index, "invalid_amount", "Amount must be a finite positive decimal", "amount", amount)

        currency = record.get("currency")
        if currency and currency not in VALID_CURRENCIES:
            issue(index, "invalid_currency", "Currency is not in the supported currency set", "currency", currency)
        status = record.get("status")
        if status and status not in VALID_STATUSES:
            issue(index, "invalid_status", "Status is not in the supported status set", "status", status)

        if account_refs is not None and record.get("account_id") and record["account_id"] not in account_refs:
            issue(index, "invalid_account_reference", "Account ID does not exist in the supplied account set", "account_id", record["account_id"])
        if customer_refs is not None and record.get("customer_id") and record["customer_id"] not in customer_refs:
            issue(index, "invalid_customer_reference", "Customer ID does not exist in the supplied customer set", "customer_id", record["customer_id"])

    if expected_refs is not None and source_type == "ledger":
        observed = {value for value in frame["transaction_id"].dropna().astype(str)}
        for transaction_id in sorted(expected_refs - observed):
            result.issues.append(IngestionIssue(
                "missing_ledger_record",
                "Expected transaction has no ledger record",
                column="transaction_id",
                value=transaction_id,
            ))

    result.records = [record for index, record in normalized.items() if index not in rejected]
    result.accepted_rows = len(result.records)
    result.rejected_rows = len(rejected)
    return result
