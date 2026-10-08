"""Create the FinanceFlow schema in the configured PostgreSQL database."""

from sqlalchemy import inspect, text

from database import Base, EXPECTED_DATABASE_NAME, engine
import models  # noqa: F401 - registers model metadata with Base
from migrations import apply_processing_schema_updates


if engine is None:
    raise SystemExit("DATABASE_URL is not configured in the project .env file")

if engine.url.database != EXPECTED_DATABASE_NAME:
    raise SystemExit(f"Refusing to modify a database other than {EXPECTED_DATABASE_NAME}")

expected = {
    "users",
    "customers",
    "accounts",
    "transactions",
    "validation_results",
    "reconciliation_results",
    "exceptions",
    "audit_logs",
    "system_configs",
}

with engine.begin() as connection:
    active_database = connection.execute(text("SELECT current_database()")).scalar_one()
    if active_database != EXPECTED_DATABASE_NAME:
        raise SystemExit(f"Connected database is not {EXPECTED_DATABASE_NAME}; refusing to continue")
    Base.metadata.create_all(bind=connection)
    apply_processing_schema_updates(connection)
    actual = set(inspect(connection).get_table_names())

missing = expected - actual
if missing:
    raise SystemExit(f"Schema verification failed; missing FinanceFlow tables: {', '.join(sorted(missing))}")

print(f"Database verified: {EXPECTED_DATABASE_NAME}")
print("FinanceFlow tables present: " + ", ".join(sorted(expected)))
