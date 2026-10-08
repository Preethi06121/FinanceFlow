"""Persist FinanceFlow validation, reconciliation, and exception results."""

from __future__ import annotations

import csv
from collections import Counter
from decimal import Decimal
from pathlib import Path
from typing import Any

from sqlalchemy import func, or_, select, text
from sqlalchemy.orm import Session

from models import Account, Customer, ExceptionRecord, ReconciliationResult, Transaction, ValidationResult
from processing.exceptions import create_processing_exceptions
from processing.reconciliation import reconcile_sales_to_ledger
from processing.validation import parse_amount, parse_transaction_date, validate_transactions

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_DATA_DIR = PROJECT_ROOT / "data" / "synthetic"


def _read_csv(path: Path) -> list[dict[str, Any]]:
    with path.open("r", encoding="utf-8-sig", newline="") as source:
        return list(csv.DictReader(source))


def _ensure_reference_data(session: Session, data_dir: Path) -> tuple[dict[str, int], dict[str, int]]:
    customers = _read_csv(data_dir / "customers.csv")
    accounts = _read_csv(data_dir / "accounts.csv")
    customer_refs = {row["customer_id"] for row in customers if row.get("customer_id")}
    existing_customers = set(session.scalars(select(Customer.external_ref).where(Customer.external_ref.in_(customer_refs))))
    for row in customers:
        external_ref = row.get("customer_id")
        if external_ref and external_ref not in existing_customers:
            session.add(Customer(external_ref=external_ref, name=row.get("name") or external_ref, email=row.get("email") or None))
    session.flush()
    customer_ids = {
        ref: identifier
        for ref, identifier in session.execute(
            select(Customer.external_ref, Customer.id).where(Customer.external_ref.in_(customer_refs))
        )
        if ref is not None
    }

    account_refs = {row["account_id"] for row in accounts if row.get("account_id")}
    existing_accounts = set(session.scalars(select(Account.account_number).where(Account.account_number.in_(account_refs))))
    for row in accounts:
        account_ref = row.get("account_id")
        customer_id = customer_ids.get(row.get("customer_id"))
        if account_ref and account_ref not in existing_accounts and customer_id is not None:
            session.add(Account(
                customer_id=customer_id,
                account_number=account_ref,
                currency=(row.get("currency") or "USD")[:3],
                status=row.get("status") or "active",
                balance=Decimal("0.00"),
            ))
    session.flush()
    account_ids = {
        number: identifier
        for number, identifier in session.execute(
            select(Account.account_number, Account.id).where(Account.account_number.in_(account_refs))
        )
    }
    return customer_ids, account_ids


def run_processing(session: Session, data_dir: str | Path = DEFAULT_DATA_DIR) -> dict[str, Any]:
    """Run the synthetic data through the core engine and persist its results.

    This pipeline accepts a SQLAlchemy session so the service layer remains
    separate from FastAPI. Database writes are limited to FinanceFlow_db.
    """
    bind = session.get_bind()
    if bind.url.database != "FinanceFlow_db":
        raise RuntimeError("Refusing to process data outside FinanceFlow_db")
    active_database = session.execute(text("SELECT current_database()")).scalar_one()
    if active_database != "FinanceFlow_db":
        raise RuntimeError("Connected database is not FinanceFlow_db")

    source_dir = Path(data_dir)
    sales_records = _read_csv(source_dir / "sales.csv")
    ledger_records = _read_csv(source_dir / "ledger.csv")
    customer_ids, account_ids = _ensure_reference_data(session, source_dir)
    account_customer_rows = session.execute(
        select(Account.account_number, Customer.external_ref)
        .join(Customer, Customer.id == Account.customer_id)
        .where(Account.account_number.in_(account_ids))
    )
    account_customers = {account: customer for account, customer in account_customer_rows}

    validation_checks = validate_transactions(
        sales_records,
        account_ids=account_ids.keys(),
        customer_ids=customer_ids.keys(),
        account_customers=account_customers,
    )
    reconciliation_checks = reconcile_sales_to_ledger(sales_records, ledger_records)

    transaction_rows = {check.transaction_reference: check for check in validation_checks if check.passed and check.transaction_reference}
    references = set(transaction_rows)
    transaction_ids = {
        reference: identifier
        for reference, identifier in session.execute(
            select(Transaction.reference, Transaction.id).where(Transaction.reference.in_(references))
        )
    }
    new_transactions = []
    for reference, check in transaction_rows.items():
        if reference in transaction_ids:
            continue
        record = check.record
        amount = parse_amount(record.get("amount"))
        date = parse_transaction_date(record.get("transaction_date"))
        account_id = account_ids[str(record["account_id"]).strip()]
        transaction = Transaction(
            reference=reference,
            to_account_id=account_id,
            amount=amount,
            currency=str(record["currency"]).upper(),
            status=str(record["status"]).lower(),
            transaction_type=str(record["transaction_type"]).upper(),
            transaction_date=date,
            description="Imported from synthetic sales source",
        )
        new_transactions.append(transaction)
    if new_transactions:
        session.add_all(new_transactions)
        session.flush()
    transaction_ids.update({
        reference: identifier
        for reference, identifier in session.execute(
            select(Transaction.reference, Transaction.id).where(Transaction.reference.in_(references))
        )
    })

    # Preserve existing processing results for an idempotent rerun.
    prior_validation_keys = {
        (reference, source_row, rule_name)
        for reference, source_row, rule_name in session.execute(
            select(ValidationResult.transaction_reference, ValidationResult.source_row, ValidationResult.rule_name)
            .where(ValidationResult.transaction_reference.in_({c.transaction_reference for c in validation_checks if c.transaction_reference}))
        )
    }
    validation_rows = []
    validation_failures = sum(len(check.failures) for check in validation_checks)
    failed_transactions = 0
    for check in validation_checks:
        if check.failures:
            failed_transactions += 1
        for rule in check.rules:
            key = (check.transaction_reference, check.row_number, rule.rule_id)
            if key in prior_validation_keys:
                continue
            validation_rows.append({
                "transaction_id": transaction_ids.get(check.transaction_reference),
                "transaction_reference": check.transaction_reference,
                "source_row": check.row_number,
                "status": "PASS" if rule.passed else "FAIL",
                "rule_name": rule.rule_id,
                "details": {"message": rule.message},
            })
    if validation_rows:
        session.bulk_insert_mappings(ValidationResult, validation_rows)

    prior_reconciliation_refs = set(session.scalars(select(ReconciliationResult.transaction_reference)))
    reconciliation_rows = []
    reconciliation_counts: Counter[str] = Counter()
    for check in reconciliation_checks:
        reconciliation_counts[check.status] += 1
        if check.transaction_reference in prior_reconciliation_refs:
            continue
        reconciliation_rows.append({
            "transaction_id": transaction_ids.get(check.transaction_reference),
            "transaction_reference": check.transaction_reference,
            "status": check.status,
            "source_reference": check.transaction_reference,
            "source_amount": check.source_amount,
            "ledger_amount": check.ledger_amount,
            "difference": check.difference,
            "details": {"reason": check.reason},
        })
    if reconciliation_rows:
        session.bulk_insert_mappings(ReconciliationResult, reconciliation_rows)

    exceptions_added = create_processing_exceptions(
        session,
        validation_checks,
        reconciliation_checks,
        transaction_ids=transaction_ids,
        customer_ids=customer_ids,
    )
    session.commit()
    auto_exceptions = session.scalar(
        select(func.count()).select_from(ExceptionRecord).where(
            or_(
                ExceptionRecord.source_key.like("validation:T%"),
                ExceptionRecord.source_key.like("reconciliation:T%"),
            )
        )
    ) or 0

    return {
        "database": "FinanceFlow_db",
        "sales_rows": len(sales_records),
        "valid_transactions": len(transaction_rows),
        "validation_failures": validation_failures,
        "transactions_with_validation_failures": failed_transactions,
        "reconciliation": {
            status: reconciliation_counts.get(status, 0)
            for status in ("MATCHED", "AMOUNT_MISMATCH", "MISSING_LEDGER", "MISSING_SOURCE")
        },
        "exceptions_created": auto_exceptions,
        "exceptions_added_this_run": exceptions_added,
    }
