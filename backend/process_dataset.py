"""Run the FinanceFlow processing services on data/synthetic and persist results."""

import json

from database import SessionLocal, engine
from processing.pipeline import run_processing


if engine is None or SessionLocal is None:
    raise SystemExit("DATABASE_URL is not configured")
if engine.url.database != "FinanceFlow_db":
    raise SystemExit("Refusing to process data outside FinanceFlow_db")

with SessionLocal() as session:
    try:
        result = run_processing(session)
    except Exception:
        session.rollback()
        raise

print(json.dumps(result, indent=2, sort_keys=True))
