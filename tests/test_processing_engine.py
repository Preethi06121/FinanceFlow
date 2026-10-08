import sys
import unittest
from decimal import Decimal
from pathlib import Path

from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT / "backend"))

from models import AuditLog, Base, ExceptionRecord  # noqa: E402
from processing.exceptions import create_exception, create_processing_exceptions, transition_exception  # noqa: E402
from processing.reconciliation import reconcile_sales_to_ledger  # noqa: E402
from processing.validation import RULES, validate_transactions  # noqa: E402


VALID_RECORD = {
    "transaction_id": "TX-1",
    "amount": "12.34",
    "currency": "USD",
    "transaction_type": "SALE",
    "transaction_date": "2026-01-15T10:30:00+00:00",
    "account_id": "A-1",
    "customer_id": "C-1",
    "status": "settled",
}
ACCOUNTS = {"A-1", "A-2"}
CUSTOMERS = {"C-1", "C-2"}
RELATIONSHIPS = {"A-1": "C-1", "A-2": "C-2"}


def failed_rules(records):
    checks = validate_transactions(
        records,
        account_ids=ACCOUNTS,
        customer_ids=CUSTOMERS,
        account_customers=RELATIONSHIPS,
    )
    return {failure.rule_id for check in checks for failure in check.failures}, checks


class ValidationRuleTests(unittest.TestCase):
    def test_all_ten_rules_accept_a_valid_record(self):
        checks = validate_transactions(
            [VALID_RECORD],
            account_ids=ACCOUNTS,
            customer_ids=CUSTOMERS,
            account_customers=RELATIONSHIPS,
        )
        self.assertEqual(len(checks[0].rules), 10)
        self.assertEqual({rule.rule_id for rule in checks[0].rules}, set(RULES))
        self.assertTrue(checks[0].passed)

    def test_v001_transaction_id_required(self):
        row = {**VALID_RECORD, "transaction_id": ""}
        self.assertIn("V001", failed_rules([row])[0])

    def test_v002_amount_must_be_positive(self):
        row = {**VALID_RECORD, "amount": "0"}
        self.assertIn("V002", failed_rules([row])[0])

    def test_v003_currency_must_be_supported(self):
        row = {**VALID_RECORD, "currency": "XYZ"}
        self.assertIn("V003", failed_rules([row])[0])

    def test_v004_transaction_type_must_be_supported(self):
        row = {**VALID_RECORD, "transaction_type": "CHARGEBACK"}
        self.assertIn("V004", failed_rules([row])[0])

    def test_v005_transaction_date_must_parse(self):
        row = {**VALID_RECORD, "transaction_date": "not-a-date"}
        self.assertIn("V005", failed_rules([row])[0])

    def test_v006_account_must_exist(self):
        row = {**VALID_RECORD, "account_id": "unknown"}
        self.assertIn("V006", failed_rules([row])[0])

    def test_v007_detects_duplicate_transaction_ids(self):
        duplicates, checks = failed_rules([VALID_RECORD, dict(VALID_RECORD)])
        self.assertIn("V007", duplicates)
        self.assertNotIn("V007", {failure.rule_id for failure in checks[0].failures})

    def test_v008_customer_must_exist(self):
        row = {**VALID_RECORD, "customer_id": "unknown"}
        self.assertIn("V008", failed_rules([row])[0])

    def test_v009_status_must_be_supported(self):
        row = {**VALID_RECORD, "status": "processing"}
        self.assertIn("V009", failed_rules([row])[0])

    def test_v010_account_customer_relationship_must_match(self):
        row = {**VALID_RECORD, "account_id": "A-2", "customer_id": "C-1"}
        self.assertIn("V010", failed_rules([row])[0])


class ReconciliationTests(unittest.TestCase):
    def test_match_amount_mismatch_and_missing_records(self):
        sales = [
            {"transaction_id": "MATCH", "amount": "10.20"},
            {"transaction_id": "MISMATCH", "amount": "100.10"},
            {"transaction_id": "NO_LEDGER", "amount": "4.00"},
        ]
        ledger = [
            {"transaction_id": "MATCH", "amount": "10.20"},
            {"transaction_id": "MISMATCH", "amount": "99.00"},
            {"transaction_id": "NO_SOURCE", "amount": "7.00"},
        ]
        results = {result.transaction_reference: result for result in reconcile_sales_to_ledger(sales, ledger)}
        self.assertEqual(results["MATCH"].status, "MATCHED")
        self.assertEqual(results["MISMATCH"].status, "AMOUNT_MISMATCH")
        self.assertEqual(results["MISMATCH"].difference, Decimal("1.10"))
        self.assertEqual(results["NO_LEDGER"].status, "MISSING_LEDGER")
        self.assertEqual(results["NO_SOURCE"].status, "MISSING_SOURCE")

    def test_invalid_source_amount_is_not_reported_as_a_mismatch(self):
        results = reconcile_sales_to_ledger(
            [{"transaction_id": "TX-INVALID", "amount": ""}],
            [{"transaction_id": "TX-INVALID", "amount": "4.00"}],
        )
        self.assertEqual(results, [])

    def test_invalid_source_amount_is_not_reported_as_a_mismatch(self):
        results = reconcile_sales_to_ledger(
            [{"transaction_id": "TX-INVALID", "amount": ""}],
            [{"transaction_id": "TX-INVALID", "amount": "4.00"}],
        )
        self.assertEqual(results, [])


class ExceptionAndAuditTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite+pysqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.session = Session(self.engine)

    def tearDown(self):
        self.session.close()
        self.engine.dispose()

    def test_processing_failures_create_exceptions(self):
        checks = validate_transactions(
            [{**VALID_RECORD, "amount": "-2"}],
            account_ids=ACCOUNTS,
            customer_ids=CUSTOMERS,
            account_customers=RELATIONSHIPS,
        )
        reconciliation = reconcile_sales_to_ledger(
            [{"transaction_id": "TX-1", "amount": "5.00"}],
            [{"transaction_id": "TX-1", "amount": "4.00"}],
        )
        count = create_processing_exceptions(
            self.session,
            checks,
            reconciliation,
            transaction_ids={},
            customer_ids={},
        )
        self.session.commit()
        records = list(self.session.scalars(select(ExceptionRecord)))
        self.assertEqual(count, 2)
        self.assertEqual(len(records), 2)
        mismatch = next(record for record in records if record.exception_type == "AMOUNT_MISMATCH")
        self.assertEqual(mismatch.difference, Decimal("1.00"))
        self.assertEqual(mismatch.status, "OPEN")

    def test_lifecycle_requires_resolution_reason_and_audits_each_transition(self):
        exception = create_exception(
            self.session,
            exception_type="V002",
            reason="Amount must be positive",
            priority="HIGH",
            transaction_reference="TX-1",
        )
        self.session.commit()
        transition_exception(self.session, exception.id, "UNDER_REVIEW")
        self.session.commit()
        with self.assertRaisesRegex(ValueError, "Resolution reason is required"):
            transition_exception(self.session, exception.id, "RESOLVED")
        self.session.rollback()
        transition_exception(
            self.session,
            exception.id,
            "RESOLVED",
            resolution_reason="Corrected in source system",
        )
        self.session.commit()

        saved = self.session.get(ExceptionRecord, exception.id)
        audit_entries = list(self.session.scalars(select(AuditLog).order_by(AuditLog.id)))
        self.assertEqual(saved.status, "RESOLVED")
        self.assertEqual(saved.resolution_reason, "Corrected in source system")
        self.assertIsNotNone(saved.resolved_at)
        self.assertEqual(len(audit_entries), 2)
        self.assertEqual([entry.details["to"] for entry in audit_entries], ["UNDER_REVIEW", "RESOLVED"])

    def test_invalid_transition_is_rejected(self):
        exception = create_exception(
            self.session,
            exception_type="V001",
            reason="Transaction ID is required",
            priority="MEDIUM",
        )
        self.session.commit()
        with self.assertRaisesRegex(ValueError, "Invalid exception transition"):
            transition_exception(self.session, exception.id, "RESOLVED", resolution_reason="Done")


if __name__ == "__main__":
    unittest.main()
