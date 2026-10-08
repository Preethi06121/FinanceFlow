"""Generate a reproducible, intentionally imperfect FinanceFlow dataset."""

from __future__ import annotations

import argparse
import json
import random
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from pathlib import Path

import pandas as pd


TRANSACTION_COUNT = 10_000
CUSTOMER_COUNT = 1_000
ACCOUNT_COUNT = 1_500
SEED = 20261007
CURRENCIES = ("USD", "EUR", "GBP", "CAD", "INR")
STATUSES = ("settled", "pending", "failed", "reversed")
TRANSACTION_TYPES = ("SALE", "REFUND", "TRANSFER", "ADJUSTMENT")


def build_dataset(output_dir: Path, seed: int = SEED) -> dict[str, int]:
    rng = random.Random(seed)
    output_dir.mkdir(parents=True, exist_ok=True)
    start = datetime(2025, 1, 1, tzinfo=timezone.utc)

    customers = pd.DataFrame(
        [
            {
                "customer_id": f"C{idx:06d}",
                "name": f"Customer {idx:04d}",
                "email": f"customer{idx:04d}@example.test",
                "created_at": (start + timedelta(days=rng.randrange(600))).isoformat(),
            }
            for idx in range(1, CUSTOMER_COUNT + 1)
        ]
    )
    accounts = pd.DataFrame(
        [
            {
                "account_id": f"A{idx:06d}",
                "customer_id": f"C{rng.randrange(1, CUSTOMER_COUNT + 1):06d}",
                "account_number": f"FF{idx:010d}",
                "currency": rng.choice(CURRENCIES),
                "status": "active",
                "opened_at": (start + timedelta(days=rng.randrange(600))).isoformat(),
            }
            for idx in range(1, ACCOUNT_COUNT + 1)
        ]
    )

    sales_rows: list[dict] = []
    payment_rows: list[dict] = []
    ledger_rows: list[dict] = []
    account_ids = accounts["account_id"].tolist()
    account_customers = dict(zip(accounts["account_id"], accounts["customer_id"]))
    account_currencies = dict(zip(accounts["account_id"], accounts["currency"]))
    transaction_ids = [f"T{idx:08d}" for idx in range(1, TRANSACTION_COUNT + 1)]

    for idx, transaction_id in enumerate(transaction_ids, start=1):
        account_id = rng.choice(account_ids)
        customer_id = account_customers[account_id]
        amount = f"{Decimal(rng.randint(100, 500000)) / Decimal('100'):.2f}"
        currency = account_currencies[account_id]
        status = rng.choice(STATUSES)
        date = start + timedelta(days=rng.randrange(620), seconds=rng.randrange(86400))
        date_text = date.isoformat()
        sales_rows.append({
            "transaction_id": transaction_id,
            "customer_id": customer_id,
            "account_id": account_id,
            "transaction_date": date_text,
            "amount": amount,
            "currency": currency,
            "status": status,
            "transaction_type": rng.choice(TRANSACTION_TYPES),
        })
        payment_rows.append({
            "payment_id": f"P{idx:08d}",
            "transaction_id": transaction_id,
            "account_id": account_id,
            "payment_date": date_text,
            "amount": amount,
            "currency": currency,
            "status": "posted" if status == "settled" else status,
        })
        ledger_rows.append({
            "ledger_id": f"L{idx:08d}",
            "transaction_id": transaction_id,
            "account_id": account_id,
            "entry_date": date_text,
            "amount": amount,
            "currency": currency,
            "status": "posted",
            "entry_type": "credit",
        })

    sales = pd.DataFrame(sales_rows)
    payments = pd.DataFrame(payment_rows)
    ledger = pd.DataFrame(ledger_rows)

    # Fixed, non-overlapping corruption ranges make the issue mix reproducible.
    sales.loc[range(100, 110), "amount"] = None
    sales.loc[range(110, 115), "transaction_date"] = "not-a-date"
    sales.loc[range(115, 120), "currency"] = "ZZZ"
    sales.loc[range(120, 125), "customer_id"] = None
    sales.loc[range(125, 130), "account_id"] = "A999999"
    sales.loc[range(130, 135), "status"] = "unknown"
    sales.loc[range(135, 140), "transaction_type"] = "UNKNOWN_TYPE"
    sales = pd.concat([sales, sales.iloc[0:20]], ignore_index=True)

    payments.loc[range(100, 110), "amount"] = "-1.00"
    payments.loc[range(110, 115), "payment_date"] = None
    payments.loc[range(115, 120), "currency"] = "USDX"
    payments.loc[range(120, 125), "account_id"] = "A999998"
    payments.loc[range(125, 130), "status"] = "processing_unknown"
    payments = pd.concat([payments, payments.iloc[20:30]], ignore_index=True)

    ledger.loc[range(200, 230), "amount"] = ledger.loc[range(200, 230), "amount"].map(
        lambda value: f"{Decimal(str(value)) + Decimal('5.00'):.2f}"
    )
    ledger.loc[range(130, 135), "account_id"] = "A999997"
    ledger = pd.concat([ledger.drop(index=range(9_950, 10_000)), ledger.iloc[0:10]], ignore_index=True)

    frames = {
        "customers": customers,
        "accounts": accounts,
        "sales": sales,
        "payments": payments,
        "ledger": ledger,
    }
    for name, frame in frames.items():
        frame.to_csv(output_dir / f"{name}.csv", index=False)

    issue_summary = {
        "seed": seed,
        "base_transactions": TRANSACTION_COUNT,
        "rows": {name: len(frame) for name, frame in frames.items()},
        "injected_issues": {
            "sales_duplicate_transactions": 20,
            "sales_missing_amount": 10,
            "sales_invalid_dates": 5,
            "sales_invalid_currency": 5,
            "sales_missing_customer_reference": 5,
            "sales_invalid_account_reference": 5,
            "sales_invalid_status": 5,
            "sales_invalid_transaction_type": 5,
            "payments_duplicate_transactions": 10,
            "payments_invalid_amount": 10,
            "payments_missing_date": 5,
            "payments_invalid_currency": 5,
            "payments_invalid_account_reference": 5,
            "payments_invalid_status": 5,
            "ledger_missing_transactions": 50,
            "ledger_amount_mismatches": 30,
            "ledger_invalid_account_reference": 5,
            "ledger_duplicate_transactions": 10,
        },
    }
    (output_dir / "dataset_summary.json").write_text(
        json.dumps(issue_summary, indent=2) + "\n", encoding="utf-8"
    )
    return issue_summary["rows"]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path(__file__).resolve().parents[2] / "data" / "synthetic",
    )
    parser.add_argument("--seed", type=int, default=SEED)
    args = parser.parse_args()
    row_counts = build_dataset(args.output_dir, seed=args.seed)
    print("Generated synthetic CSV files:")
    for name, count in row_counts.items():
        print(f"  {name}: {count} rows")


if __name__ == "__main__":
    main()
