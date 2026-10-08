import json
import sys
import tempfile
import unittest
from pathlib import Path

import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT / "backend"))

from data.generate_synthetic_data import SEED, build_dataset  # noqa: E402
from ingestion.service import ingest_csv  # noqa: E402


class SyntheticDataTests(unittest.TestCase):
    def test_generator_is_seeded_and_has_about_ten_thousand_transactions(self):
        with tempfile.TemporaryDirectory() as first_dir, tempfile.TemporaryDirectory() as second_dir:
            counts = build_dataset(Path(first_dir), SEED)
            build_dataset(Path(second_dir), SEED)

            for name in ("customers", "accounts", "sales", "payments", "ledger"):
                self.assertEqual(
                    (Path(first_dir) / f"{name}.csv").read_bytes(),
                    (Path(second_dir) / f"{name}.csv").read_bytes(),
                )
            self.assertEqual(counts["sales"], 10_020)
            self.assertEqual(counts["payments"], 10_010)
            self.assertEqual(counts["ledger"], 9_960)
            summary = json.loads((Path(first_dir) / "dataset_summary.json").read_text(encoding="utf-8"))
            self.assertEqual(summary["base_transactions"], 10_000)


class IngestionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp_dir = tempfile.TemporaryDirectory()
        cls.data_dir = Path(cls.temp_dir.name)
        build_dataset(cls.data_dir, SEED)
        cls.account_ids = pd.read_csv(cls.data_dir / "accounts.csv")["account_id"].tolist()
        cls.customer_ids = pd.read_csv(cls.data_dir / "customers.csv")["customer_id"].tolist()
        cls.transaction_ids = [f"T{idx:08d}" for idx in range(1, 10_001)]

    @classmethod
    def tearDownClass(cls):
        cls.temp_dir.cleanup()

    def test_sales_reports_controlled_quality_issues(self):
        result = ingest_csv(
            self.data_dir / "sales.csv",
            "sales",
            account_ids=self.account_ids,
            customer_ids=self.customer_ids,
        )
        codes = {issue.code for issue in result.issues}
        self.assertTrue({
            "duplicate_transaction",
            "missing_value",
            "invalid_date",
            "invalid_currency",
            "invalid_status",
            "invalid_account_reference",
        }.issubset(codes))
        self.assertEqual(result.total_rows, 10_020)
        self.assertGreater(result.rejected_rows, 0)
        self.assertEqual(result.accepted_rows + result.rejected_rows, result.total_rows)

    def test_ledger_reports_duplicate_and_missing_transactions(self):
        result = ingest_csv(
            self.data_dir / "ledger.csv",
            "ledger",
            account_ids=self.account_ids,
            expected_transaction_ids=self.transaction_ids,
            expected_amounts={
                str(row.transaction_id): str(row.amount)
                for row in pd.read_csv(self.data_dir / "sales.csv").itertuples()
                if pd.notna(row.amount)
            },
        )
        codes = [issue.code for issue in result.issues]
        self.assertEqual(codes.count("missing_ledger_record"), 50)
        self.assertEqual(codes.count("duplicate_transaction"), 10)
        self.assertEqual(codes.count("amount_mismatch"), 30)
        self.assertIn("invalid_account_reference", codes)

    def test_payment_rejects_invalid_amount_and_status(self):
        result = ingest_csv(
            self.data_dir / "payments.csv",
            "payments",
            account_ids=self.account_ids,
        )
        codes = {issue.code for issue in result.issues}
        self.assertIn("invalid_amount", codes)
        self.assertIn("invalid_status", codes)
        self.assertIn("invalid_currency", codes)
        self.assertIn("duplicate_transaction", codes)

    def test_missing_required_column_is_reported(self):
        path = self.data_dir / "missing_column.csv"
        pd.DataFrame([{"transaction_id": "T1"}]).to_csv(path, index=False)
        result = ingest_csv(path, "sales")
        self.assertEqual(result.accepted_rows, 0)
        self.assertEqual(result.rejected_rows, 1)
        self.assertEqual(
            sum(issue.code == "missing_column" for issue in result.issues),
            7,
        )


if __name__ == "__main__":
    unittest.main()
