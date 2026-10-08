import os
import sys
import unittest
import asyncio
import secrets
from decimal import Decimal
from pathlib import Path
from unittest.mock import patch

from httpx2 import ASGITransport, AsyncClient
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT / "backend"))

from database import get_db  # noqa: E402
from main import app  # noqa: E402
from models import (  # noqa: E402
    Account,
    AuditLog,
    Base,
    Customer,
    ExceptionRecord,
    ReconciliationResult,
    Transaction,
    User,
)
from processing.exceptions import create_exception  # noqa: E402
from security.auth import hash_password, verify_password  # noqa: E402


class SyncASGIClient:
    """Synchronous unittest adapter over an in-process async ASGI client."""

    def __init__(self, application):
        self.application = application

    async def _send(self, method, url, **kwargs):
        async with AsyncClient(
            transport=ASGITransport(app=self.application),
            base_url="http://financeflow.test",
        ) as client:
            return await client.request(method, url, **kwargs)

    def request(self, method, url, **kwargs):
        return asyncio.run(self._send(method, url, **kwargs))

    def get(self, url, **kwargs):
        return self.request("GET", url, **kwargs)

    def post(self, url, **kwargs):
        return self.request("POST", url, **kwargs)

    def patch(self, url, **kwargs):
        return self.request("PATCH", url, **kwargs)

    def put(self, url, **kwargs):
        return self.request("PUT", url, **kwargs)

    def close(self):
        pass


class ApiAuthTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        os.environ["AUTH_SECRET_KEY"] = "test-only-signing-key-with-at-least-32-bytes"
        cls.password = "analyst-test-password"
        cls.password_hash = hash_password(cls.password)
        cls.admin_password_hash = hash_password("administrator-test-password")

    def setUp(self):
        self.engine = create_engine(
            "sqlite+pysqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        Base.metadata.create_all(self.engine)
        self.TestSession = sessionmaker(bind=self.engine, expire_on_commit=False)
        with self.TestSession() as session:
            self.analyst = User(
                email="analyst@example.test",
                full_name="Analyst User",
                password_hash=self.password_hash,
                role="ANALYST",
                is_active=True,
            )
            self.admin = User(
                email="admin@example.test",
                full_name="Admin User",
                password_hash=self.admin_password_hash,
                role="ADMIN",
                is_active=True,
            )
            session.add_all([self.analyst, self.admin])
            session.flush()
            self.customer = Customer(external_ref="C-API", name="Test Customer")
            session.add(self.customer)
            session.flush()
            self.account = Account(
                customer_id=self.customer.id,
                account_number="A-API",
                currency="USD",
                balance=Decimal("100.00"),
                status="active",
            )
            session.add(self.account)
            session.flush()
            self.transaction = Transaction(
                reference="TX-API-1",
                to_account_id=self.account.id,
                amount=Decimal("10.25"),
                currency="USD",
                transaction_type="SALE",
                status="settled",
                description="API test transaction",
            )
            session.add(self.transaction)
            session.add(ReconciliationResult(
                transaction_reference="TX-API-1",
                transaction_id=None,
                status="MATCHED",
                source_amount=Decimal("10.25"),
                ledger_amount=Decimal("10.25"),
                difference=Decimal("0.00"),
            ))
            self.exception = create_exception(
                session,
                exception_type="V002",
                transaction_reference="TX-API-1",
                reason="Amount must be positive",
                priority="HIGH",
            )
            session.add(AuditLog(action="created", entity_type="exception", entity_id="fixture", details={"test": True}))
            session.commit()
            self.analyst_id = self.analyst.id
            self.admin_id = self.admin.id
            self.transaction_id = self.transaction.id
            self.exception_id = self.exception.id

        def override_get_db():
            with self.TestSession() as session:
                yield session

        app.dependency_overrides[get_db] = override_get_db
        self.client = SyncASGIClient(app)

    def tearDown(self):
        self.client.close()
        app.dependency_overrides.clear()
        self.engine.dispose()

    def token(self, email="analyst@example.test", password=None):
        response = self.client.post("/auth/login", json={
            "email": email,
            "password": password or self.password,
        })
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()["access_token"]

    def headers(self, email="analyst@example.test", password=None):
        return {"Authorization": f"Bearer {self.token(email, password)}"}

    def test_private_routes_require_authentication(self):
        self.assertEqual(self.client.get("/transactions").status_code, 401)
        self.assertEqual(self.client.get("/dashboard/summary").status_code, 401)

    def test_login_returns_bearer_token_without_password_hash(self):
        response = self.client.post("/auth/login", json={
            "email": "ANALYST@example.test",
            "password": self.password,
        })
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["role"], "ANALYST")
        self.assertEqual(response.json()["token_type"], "bearer")
        self.assertNotIn("password", response.text.lower())
        self.assertNotIn("password_hash", response.text)

    def test_invalid_login_is_generic_unauthorized(self):
        response = self.client.post("/auth/login", json={
            "email": "analyst@example.test",
            "password": "wrong-password",
        })
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json()["detail"], "Invalid email or password")

    def test_public_registration_creates_analyst_with_a_hashed_password_and_login_works(self):
        password = secrets.token_urlsafe(24)
        response = self.client.post("/auth/register", json={
            "full_name": "  Registration Analyst  ",
            "email": "  NEW.ANALYST@EXAMPLE.TEST  ",
            "password": password,
        })
        self.assertEqual(response.status_code, 201, response.text)
        self.assertEqual(response.json()["email"], "new.analyst@example.test")
        self.assertEqual(response.json()["full_name"], "Registration Analyst")
        self.assertEqual(response.json()["role"], "ANALYST")
        self.assertNotIn(password, response.text)
        self.assertNotIn("password_hash", response.text)
        with self.TestSession() as session:
            user = session.scalar(select(User).where(User.email == "new.analyst@example.test"))
            self.assertIsNotNone(user)
            self.assertNotEqual(user.password_hash, password)
            self.assertTrue(user.password_hash.startswith("pbkdf2_sha256$"))
            self.assertTrue(verify_password(password, user.password_hash))
        login = self.client.post("/auth/login", json={
            "email": "new.analyst@example.test",
            "password": password,
        })
        self.assertEqual(login.status_code, 200, login.text)
        self.assertEqual(login.json()["role"], "ANALYST")

    def test_public_registration_rejects_duplicate_email(self):
        payload = {
            "full_name": "New Person",
            "email": "duplicate@example.test",
            "password": secrets.token_urlsafe(24),
        }
        self.assertEqual(self.client.post("/auth/register", json=payload).status_code, 201)
        duplicate = self.client.post("/auth/register", json=payload)
        self.assertEqual(duplicate.status_code, 409)
        self.assertIn("already exists", duplicate.json()["detail"])

    def test_public_registration_validates_fields_without_reflecting_password(self):
        invalid_email = self.client.post("/auth/register", json={
            "full_name": "New Person",
            "email": "not-an-email",
            "password": secrets.token_urlsafe(24),
        })
        self.assertEqual(invalid_email.status_code, 422)
        invalid_password = self.client.post("/auth/register", json={
            "full_name": "New Person",
            "email": "new@example.test",
            "password": "x" * 5,
        })
        self.assertEqual(invalid_password.status_code, 422)
        self.assertEqual(invalid_password.json()["detail"][0]["input"], "[redacted]")
        blank_name = self.client.post("/auth/register", json={
            "full_name": "   ",
            "email": "new@example.test",
            "password": secrets.token_urlsafe(24),
        })
        self.assertEqual(blank_name.status_code, 422)

    def test_public_registration_cannot_assign_admin_role(self):
        response = self.client.post("/auth/register", json={
            "full_name": "Role Escalation",
            "email": "role-escalation@example.test",
            "password": secrets.token_urlsafe(24),
            "role": "ADMIN",
        })
        self.assertEqual(response.status_code, 422)
        with self.TestSession() as session:
            self.assertIsNone(session.scalar(select(User.id).where(User.email == "role-escalation@example.test")))

    def test_analyst_can_read_transactions_reconciliation_exceptions_audit_and_dashboard(self):
        headers = self.headers()
        transactions = self.client.get("/transactions", headers=headers)
        self.assertEqual(transactions.status_code, 200)
        self.assertEqual(transactions.json()["total"], 1)
        self.assertEqual(transactions.json()["items"][0]["reference"], "TX-API-1")
        self.assertEqual(self.client.get(f"/transactions/{self.transaction_id}", headers=headers).status_code, 200)
        self.assertEqual(self.client.get("/reconciliation/results", headers=headers).json()["total"], 1)
        self.assertEqual(self.client.get("/exceptions", headers=headers).json()["total"], 1)
        self.assertEqual(self.client.get(f"/exceptions/{self.exception_id}", headers=headers).status_code, 200)
        self.assertEqual(self.client.get("/audit-logs", headers=headers).json()["total"], 1)
        summary = self.client.get("/dashboard/summary", headers=headers)
        self.assertEqual(summary.status_code, 200)
        self.assertEqual(summary.json()["transactions"]["count"], 1)

    def test_transaction_detail_not_found(self):
        response = self.client.get("/transactions/999", headers=self.headers())
        self.assertEqual(response.status_code, 404)

    def test_analyst_can_upload_valid_sales_csv_and_duplicate_gets_rejected(self):
        headers = self.headers()
        csv_data = (
            "transaction_id,customer_id,account_id,transaction_date,amount,currency,status,transaction_type\n"
            "TX-UPLOAD-1,C-API,A-API,2026-05-01T10:00:00Z,25.50,USD,settled,SALE\n"
        )
        first = self.client.post(
            "/transactions/upload",
            headers=headers,
            files={"file": ("sales.csv", csv_data, "text/csv")},
        )
        self.assertEqual(first.status_code, 201, first.text)
        self.assertEqual(first.json()["transactions_created"], 1)
        second = self.client.post(
            "/transactions/upload",
            headers=headers,
            files={"file": ("sales.csv", csv_data, "text/csv")},
        )
        self.assertEqual(second.status_code, 201, second.text)
        self.assertEqual(second.json()["transactions_created"], 0)
        self.assertGreaterEqual(second.json()["validation_failures"], 1)

    def test_upload_schema_and_media_type_errors(self):
        headers = self.headers()
        wrong_type = self.client.post(
            "/transactions/upload",
            headers=headers,
            files={"file": ("sales.txt", "not csv", "text/plain")},
        )
        self.assertEqual(wrong_type.status_code, 415)
        missing_column = self.client.post(
            "/transactions/upload",
            headers=headers,
            files={"file": ("sales.csv", "transaction_id\nTX1\n", "text/csv")},
        )
        self.assertEqual(missing_column.status_code, 422)

    def test_reconciliation_run_delegates_to_processing_service(self):
        headers = self.headers()
        with patch("api.routes.run_processing", return_value={"reconciled": True}) as run:
            response = self.client.post("/reconciliation/run", headers=headers)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"reconciled": True})
        run.assert_called_once()

    def test_analyst_can_transition_exception_and_audit_actor_is_saved(self):
        headers = self.headers()
        review = self.client.patch(
            f"/exceptions/{self.exception_id}",
            headers=headers,
            json={"status": "UNDER_REVIEW"},
        )
        self.assertEqual(review.status_code, 200, review.text)
        resolved = self.client.patch(
            f"/exceptions/{self.exception_id}",
            headers=headers,
            json={"status": "RESOLVED", "resolution_reason": "Corrected upstream"},
        )
        self.assertEqual(resolved.status_code, 200, resolved.text)
        self.assertEqual(resolved.json()["status"], "RESOLVED")
        with self.TestSession() as session:
            logs = list(session.scalars(select(AuditLog).where(AuditLog.entity_id == str(self.exception_id))))
            self.assertEqual(len(logs), 2)
            self.assertTrue(all(log.user_id == self.analyst_id for log in logs))

    def test_exception_resolution_requires_reason(self):
        headers = self.headers()
        self.client.patch(f"/exceptions/{self.exception_id}", headers=headers, json={"status": "UNDER_REVIEW"})
        response = self.client.patch(f"/exceptions/{self.exception_id}", headers=headers, json={"status": "RESOLVED"})
        self.assertEqual(response.status_code, 422)

    def test_analyst_is_denied_admin_routes(self):
        headers = self.headers()
        self.assertEqual(self.client.get("/admin/users", headers=headers).status_code, 403)
        self.assertEqual(self.client.get("/admin/config", headers=headers).status_code, 403)

    def test_admin_can_manage_users_and_configuration(self):
        headers = self.headers("admin@example.test", "administrator-test-password")
        created = self.client.post(
            "/admin/users",
            headers=headers,
            json={"email": "new@example.test", "full_name": "New Analyst", "password": "new-analyst-password", "role": "ANALYST"},
        )
        self.assertEqual(created.status_code, 201, created.text)
        self.assertNotIn("password_hash", created.text)
        listed = self.client.get("/admin/users", headers=headers)
        self.assertEqual(listed.status_code, 200)
        self.assertEqual(len(listed.json()), 3)
        config = self.client.put("/admin/config/risk_threshold", headers=headers, json={"value": {"limit": 5000}})
        self.assertEqual(config.status_code, 200, config.text)
        self.assertEqual(config.json()["value"], {"limit": 5000})
        self.assertEqual(self.client.get("/admin/config", headers=headers).json()[0]["key"], "risk_threshold")

    def test_health_is_public(self):
        with patch("api.routes.engine", self.engine):
            response = self.client.get("/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "ok"})


if __name__ == "__main__":
    unittest.main()
