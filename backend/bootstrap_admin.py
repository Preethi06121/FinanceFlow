"""Create the first active administrator with an interactively entered password."""

import getpass

from sqlalchemy import select, text

from database import SessionLocal, engine
from models import User
from services.users import create_user


if engine is None or SessionLocal is None or engine.url.database != "FinanceFlow_db":
    raise SystemExit("DATABASE_URL must point to FinanceFlow_db")

email = input("Administrator email: ").strip().lower()
password = getpass.getpass("Administrator password (12+ characters): ")
confirmation = getpass.getpass("Confirm password: ")
if password != confirmation:
    raise SystemExit("Passwords did not match")

with SessionLocal() as session:
    if session.execute(text("SELECT current_database()")).scalar_one() != "FinanceFlow_db":
        raise SystemExit("Refusing to bootstrap outside FinanceFlow_db")
    if session.scalar(select(User.id).where(User.role == "ADMIN", User.is_active.is_(True))) is not None:
        raise SystemExit("An active administrator already exists")
    user = create_user(session, email=email, full_name="FinanceFlow Administrator", password=password, role="ADMIN")
    session.commit()
    print(f"Created administrator account for {user.email}.")
