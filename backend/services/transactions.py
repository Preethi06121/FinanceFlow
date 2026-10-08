"""Transaction query and sales CSV upload workflows."""

from __future__ import annotations

import csv
import io
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ingestion.service import SCHEMAS, ingest_csv
from models import Account, Customer, Transaction, ValidationResult
from processing.exceptions import create_processing_exceptions
from processing.validation import parse_amount, parse_transaction_date, validate_transactions


class UploadSchemaError(ValueError):
    def __init__(self, issues: list[dict[str, Any]]):
        self.issues = issues
        super().__init__("CSV is missing required sales columns")


def list_transactions(session: Session, *, offset: int, limit: int, status: str | None = None):
    query = select(Transaction)
    count_query = select(func.count()).select_from(Transaction)
    if status:
        query = query.where(Transaction.status == status.lower())
        count_query = count_query.where(Transaction.status == status.lower())
    rows = list(session.scalars(query.order_by(Transaction.id).offset(offset).limit(limit)))
    return rows, session.scalar(count_query) or 0


def get_transaction(session: Session, transaction_id: int) -> Transaction | None:
    return session.get(Transaction, transaction_id)


def upload_sales_csv(session: Session, *, filename: str, contents: bytes) -> dict[str, Any]:
    try:
        decoded = contents.decode("utf-8-sig")
    except UnicodeDecodeError:
        raise UploadSchemaError([{"code": "invalid_encoding", "message": "CSV must use UTF-8 encoding"}]) from None

    reader = csv.DictReader(io.StringIO(decoded, newline=""))
    if reader.fieldnames is None:
        raise UploadSchemaError([{"code": "empty_file", "message": "CSV file is empty"}])
    required = set(SCHEMAS["sales"]["required"])
    missing_columns = sorted(required - set(reader.fieldnames))
    if missing_columns:
        raise UploadSchemaError([
            {"code": "missing_column", "column": column, "message": f"Required column '{column}' is missing"}
            for column in missing_columns
        ])
    records = list(reader)
    if not records:
        raise UploadSchemaError([{"code": "empty_file", "message": "CSV must contain at least one transaction"}])

    references = {
        value
        for record in records
        if (value := (record.get("transaction_id") or "").strip())
    }
    ref_rows = session.execute(
        select(Account.account_number, Account.id, Customer.external_ref, Customer.id)
        .join(Customer, Customer.id == Account.customer_id)
    ).all()
    account_ids = {account_number: account_id for account_number, account_id, _, _ in ref_rows}
    customer_ids = {external_ref: customer_id for _, _, external_ref, customer_id in ref_rows if external_ref}
    account_customers = {account_number: external_ref for account_number, _, external_ref, _ in ref_rows if external_ref}
    existing_refs = set(session.scalars(select(Transaction.reference).where(Transaction.reference.in_(references)))) if references else set()

    ingestion = ingest_csv(
        io.BytesIO(contents),
        "sales",
        account_ids=account_ids.keys(),
        customer_ids=customer_ids.keys(),
    )
    checks = validate_transactions(
        records,
        account_ids=account_ids.keys(),
        customer_ids=customer_ids.keys(),
        account_customers=account_customers,
        existing_transaction_ids=existing_refs,
    )

    valid_checks = [check for check in checks if check.passed]
    new_transactions: list[Transaction] = []
    for check in valid_checks:
        record = check.record
        new_transactions.append(Transaction(
            reference=check.transaction_reference,
            to_account_id=account_ids[str(record["account_id"]).strip()],
            amount=parse_amount(record["amount"]),
            currency=str(record["currency"]).strip().upper(),
            transaction_type=str(record["transaction_type"]).strip().upper(),
            transaction_date=parse_transaction_date(record["transaction_date"]),
            status=str(record["status"]).strip().lower(),
            description=f"Uploaded from {filename[:180]}",
        ))
    if new_transactions:
        session.add_all(new_transactions)
        session.flush()

    transaction_ids = {
        reference: identifier
        for reference, identifier in session.execute(
            select(Transaction.reference, Transaction.id).where(Transaction.reference.in_(references))
        )
    } if references else {}
    validation_rows = [
        {
            "transaction_id": transaction_ids.get(check.transaction_reference),
            "transaction_reference": check.transaction_reference,
            "source_row": check.row_number,
            "status": "PASS" if rule.passed else "FAIL",
            "rule_name": rule.rule_id,
            "details": {"message": rule.message, "source_file": filename[:200]},
        }
        for check in checks
        for rule in check.rules
    ]
    session.bulk_insert_mappings(ValidationResult, validation_rows)
    exceptions_created = create_processing_exceptions(
        session,
        checks,
        (),
        transaction_ids=transaction_ids,
        customer_ids=customer_ids,
    )
    session.commit()
    return {
        "filename": filename,
        "uploaded_rows": len(records),
        "accepted_rows": len(valid_checks),
        "rejected_rows": len(checks) - len(valid_checks),
        "validation_failures": sum(len(check.failures) for check in checks),
        "transactions_created": len(new_transactions),
        "exceptions_created": exceptions_created,
        "issues": [
            {
                "code": issue.code,
                "message": issue.message,
                "row_number": issue.row_number,
                "column": issue.column,
            }
            for issue in ingestion.issues
        ],
    }
