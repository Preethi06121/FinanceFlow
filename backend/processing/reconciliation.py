"""Sales-to-ledger reconciliation with decimal-safe arithmetic."""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from typing import Any, Iterable, Mapping

from processing.validation import parse_amount


@dataclass(frozen=True)
class ReconciliationCheck:
    transaction_reference: str
    status: str
    source_amount: Decimal | None
    ledger_amount: Decimal | None
    difference: Decimal | None
    reason: str


def reconcile_sales_to_ledger(
    sales_records: Iterable[Mapping[str, Any]],
    ledger_records: Iterable[Mapping[str, Any]],
) -> list[ReconciliationCheck]:
    """Compare the first row for each transaction ID from each source.

    Duplicate detection belongs to validation. Choosing the first row here
    keeps reconciliation deterministic while preserving duplicate failures.
    """
    sales_by_id: dict[str, Mapping[str, Any]] = {}
    ledger_by_id: dict[str, Mapping[str, Any]] = {}
    for record in sales_records:
        reference = str(record.get("transaction_id") or "").strip()
        if reference:
            sales_by_id.setdefault(reference, record)
    for record in ledger_records:
        reference = str(record.get("transaction_id") or "").strip()
        if reference:
            ledger_by_id.setdefault(reference, record)

    outcomes: list[ReconciliationCheck] = []
    for reference in sorted(sales_by_id.keys() | ledger_by_id.keys()):
        source = sales_by_id.get(reference)
        ledger = ledger_by_id.get(reference)
        source_amount = parse_amount(source.get("amount")) if source else None
        ledger_amount = parse_amount(ledger.get("amount")) if ledger else None
        if source is None:
            outcomes.append(ReconciliationCheck(reference, "MISSING_SOURCE", None, ledger_amount, None, "Ledger record has no sales source"))
        elif ledger is None:
            outcomes.append(ReconciliationCheck(reference, "MISSING_LEDGER", source_amount, None, None, "Sales record has no ledger entry"))
        elif source_amount is None or ledger_amount is None or source_amount <= 0 or ledger_amount <= 0:
            # Validation reports malformed amounts. Reconciliation only compares
            # two usable decimal amounts, so it does not label missing data as a mismatch.
            continue
        else:
            difference = source_amount - ledger_amount
            if difference == Decimal("0"):
                outcomes.append(ReconciliationCheck(reference, "MATCHED", source_amount, ledger_amount, difference, "Source and ledger amounts agree"))
            else:
                outcomes.append(ReconciliationCheck(reference, "AMOUNT_MISMATCH", source_amount, ledger_amount, difference, "Source and ledger amounts differ"))
    return outcomes
