"""Small additive schema updates for the FinanceFlow processing phase."""

from sqlalchemy import text
from sqlalchemy.engine import Connection

from database import EXPECTED_DATABASE_NAME


def apply_processing_schema_updates(connection: Connection) -> None:
    """Add processing fields to the existing FinanceFlow tables if absent."""
    if connection.execute(text("SELECT current_database()")).scalar_one() != EXPECTED_DATABASE_NAME:
        raise RuntimeError(f"Refusing schema updates outside {EXPECTED_DATABASE_NAME}")

    statements = (
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(16) NOT NULL DEFAULT 'ANALYST'",
        "ALTER TABLE users ALTER COLUMN role SET DEFAULT 'ANALYST'",
        "ALTER TABLE transactions ADD COLUMN IF NOT EXISTS transaction_type VARCHAR(32) NOT NULL DEFAULT 'sale'",
        "ALTER TABLE transactions ADD COLUMN IF NOT EXISTS transaction_date TIMESTAMPTZ",
        "ALTER TABLE validation_results ALTER COLUMN transaction_id DROP NOT NULL",
        "ALTER TABLE validation_results ADD COLUMN IF NOT EXISTS transaction_reference VARCHAR(100)",
        "ALTER TABLE validation_results ADD COLUMN IF NOT EXISTS source_row INTEGER",
        "ALTER TABLE reconciliation_results ALTER COLUMN transaction_id DROP NOT NULL",
        "ALTER TABLE reconciliation_results ADD COLUMN IF NOT EXISTS transaction_reference VARCHAR(100) NOT NULL DEFAULT ''",
        "ALTER TABLE reconciliation_results ADD COLUMN IF NOT EXISTS source_amount NUMERIC(18, 2)",
        "ALTER TABLE reconciliation_results ADD COLUMN IF NOT EXISTS ledger_amount NUMERIC(18, 2)",
        "ALTER TABLE reconciliation_results ALTER COLUMN difference DROP NOT NULL",
        "ALTER TABLE exceptions ADD COLUMN IF NOT EXISTS transaction_reference VARCHAR(100)",
        "ALTER TABLE exceptions ADD COLUMN IF NOT EXISTS source_key VARCHAR(240)",
        "ALTER TABLE exceptions ADD COLUMN IF NOT EXISTS exception_type VARCHAR(80) NOT NULL DEFAULT 'PROCESSING_FAILURE'",
        "ALTER TABLE exceptions ADD COLUMN IF NOT EXISTS source_amount NUMERIC(18, 2)",
        "ALTER TABLE exceptions ADD COLUMN IF NOT EXISTS ledger_amount NUMERIC(18, 2)",
        "ALTER TABLE exceptions ADD COLUMN IF NOT EXISTS difference NUMERIC(18, 2)",
        "ALTER TABLE exceptions ADD COLUMN IF NOT EXISTS priority VARCHAR(16) NOT NULL DEFAULT 'MEDIUM'",
        "ALTER TABLE exceptions ADD COLUMN IF NOT EXISTS reason TEXT NOT NULL DEFAULT ''",
        "ALTER TABLE exceptions ADD COLUMN IF NOT EXISTS resolution_reason TEXT",
        "ALTER TABLE exceptions ALTER COLUMN status SET DEFAULT 'OPEN'",
        "ALTER TABLE exceptions ALTER COLUMN priority SET DEFAULT 'MEDIUM'",
        "UPDATE exceptions SET status = upper(status) WHERE status IN ('open', 'under_review', 'resolved')",
        "UPDATE exceptions SET resolution_reason = 'Migrated resolved exception' WHERE status = 'RESOLVED' AND resolution_reason IS NULL",
        """DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_users_role' AND conrelid = 'users'::regclass) THEN
                ALTER TABLE users ADD CONSTRAINT ck_users_role CHECK (role IN ('ANALYST', 'ADMIN'));
            END IF;
            IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_exceptions_status' AND conrelid = 'exceptions'::regclass) THEN
                ALTER TABLE exceptions ADD CONSTRAINT ck_exceptions_status CHECK (status IN ('OPEN', 'UNDER_REVIEW', 'RESOLVED'));
            END IF;
            IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_exceptions_priority' AND conrelid = 'exceptions'::regclass) THEN
                ALTER TABLE exceptions ADD CONSTRAINT ck_exceptions_priority CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL'));
            END IF;
            IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_exceptions_resolution_reason' AND conrelid = 'exceptions'::regclass) THEN
                ALTER TABLE exceptions ADD CONSTRAINT ck_exceptions_resolution_reason CHECK (status <> 'RESOLVED' OR (resolution_reason IS NOT NULL AND length(trim(resolution_reason)) > 0));
            END IF;
            IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_exceptions_source_key' AND conrelid = 'exceptions'::regclass) THEN
                ALTER TABLE exceptions ADD CONSTRAINT uq_exceptions_source_key UNIQUE (source_key);
            END IF;
        END $$""",
    )
    for statement in statements:
        connection.execute(text(statement))
