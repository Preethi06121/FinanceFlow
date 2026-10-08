"""Create the FinanceFlow schema in the configured PostgreSQL database."""

from sqlalchemy import inspect, text

from database import Base, engine
import models  # noqa: F401 - registers model metadata with Base
from migrations import apply_processing_schema_updates


if engine is None:
    raise SystemExit("DATABASE_URL is not configured in the project .env file")

if engine.url.database != "FinanceFlow_db":
    raise SystemExit("Refusing to modify a database other than FinanceFlow_db")

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
    if active_database != "FinanceFlow_db":
        raise SystemExit("Connected database is not FinanceFlow_db; refusing to continue")
    Base.metadata.create_all(bind=connection)
    apply_processing_schema_updates(connection)
    actual = set(inspect(connection).get_table_names())

missing = expected - actual
if missing:
    raise SystemExit(f"Schema verification failed; missing FinanceFlow tables: {', '.join(sorted(missing))}")

print("Database verified: FinanceFlow_db")
print("FinanceFlow tables present: " + ", ".join(sorted(expected)))
