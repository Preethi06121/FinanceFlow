"""Thin, authenticated HTTP routes for FinanceFlow."""

from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from api.schemas import (
    AuditLogRead,
    ConfigRead,
    ConfigUpdate,
    ExceptionRead,
    ExceptionUpdate,
    LoginRequest,
    LoginResponse,
    Page,
    RegisterRequest,
    ReconciliationRead,
    TransactionRead,
    UserCreate,
    UserRead,
    UserUpdate,
)
from database import engine, get_db
from models import User
from processing.exceptions import transition_exception
from processing.pipeline import run_processing
from security.dependencies import get_current_user, require_roles
from security.service import authenticate
from services.audit_logs import list_audit_logs
from services.configuration import list_config, set_config
from services.dashboard import dashboard_summary
from services.exceptions import get_exception, list_exceptions
from services.reconciliation import list_results
from services.transactions import UploadSchemaError, get_transaction, list_transactions, upload_sales_csv
from services.users import create_user, list_users, update_user

router = APIRouter()
Db = Annotated[Session, Depends(get_db)]
Analyst = Annotated[User, Depends(require_roles("ANALYST", "ADMIN"))]
Admin = Annotated[User, Depends(require_roles("ADMIN"))]


@router.post("/auth/login", response_model=LoginResponse)
def login(request: LoginRequest, session: Db):
    try:
        result = authenticate(session, request.email, request.password)
    except RuntimeError:
        raise HTTPException(status_code=503, detail="Authentication is not configured") from None
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return result


@router.post("/auth/register", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def register(request: RegisterRequest, session: Db):
    """Create a public Analyst account; role is intentionally absent from the request schema."""
    try:
        user = create_user(
            session,
            email=request.email,
            full_name=request.full_name,
            password=request.password.get_secret_value(),
            role="ANALYST",
        )
        session.commit()
        session.refresh(user)
        return user
    except (ValueError, IntegrityError):
        session.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="An account with this email already exists") from None


@router.get("/transactions", response_model=Page[TransactionRead])
def transactions(
    session: Db,
    user: Analyst,
    offset: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    status_filter: str | None = Query(None, alias="status", pattern="^(pending|posted|settled|failed|reversed)$"),
):
    rows, total = list_transactions(session, offset=offset, limit=limit, status=status_filter)
    return {"items": [TransactionRead.model_validate(row) for row in rows], "total": total, "offset": offset, "limit": limit}


@router.get("/transactions/{transaction_id}", response_model=TransactionRead)
def transaction_detail(transaction_id: int, session: Db, user: Analyst):
    transaction = get_transaction(session, transaction_id)
    if transaction is None:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return transaction


@router.post("/transactions/upload", status_code=status.HTTP_201_CREATED)
async def upload_transactions(
    session: Db,
    user: Analyst,
    file: UploadFile = File(...),
):
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=415, detail="Upload a CSV file")
    contents = await file.read(10 * 1024 * 1024 + 1)
    if len(contents) > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="CSV file exceeds the 10 MiB upload limit")
    try:
        return upload_sales_csv(session, filename=file.filename, contents=contents)
    except UploadSchemaError as exc:
        raise HTTPException(status_code=422, detail={"message": str(exc), "issues": exc.issues}) from None
    except Exception:
        session.rollback()
        raise
    finally:
        await file.close()


@router.post("/reconciliation/run")
def reconciliation_run(session: Db, user: Analyst):
    try:
        return run_processing(session)
    except Exception:
        session.rollback()
        raise


@router.get("/reconciliation/results", response_model=Page[ReconciliationRead])
def reconciliation_results(
    session: Db,
    user: Analyst,
    offset: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    result_status: str | None = Query(None, alias="status", max_length=24),
):
    rows, total = list_results(session, offset=offset, limit=limit, result_status=result_status)
    return {"items": [ReconciliationRead.model_validate(row) for row in rows], "total": total, "offset": offset, "limit": limit}


@router.get("/exceptions", response_model=Page[ExceptionRead])
def exceptions(
    session: Db,
    user: Analyst,
    offset: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    exception_status: str | None = Query(None, alias="status", pattern="^(OPEN|UNDER_REVIEW|RESOLVED)$"),
    priority: str | None = Query(None, pattern="^(LOW|MEDIUM|HIGH|CRITICAL)$"),
):
    rows, total = list_exceptions(session, offset=offset, limit=limit, status=exception_status, priority=priority)
    return {"items": [ExceptionRead.model_validate(row) for row in rows], "total": total, "offset": offset, "limit": limit}


@router.get("/exceptions/{exception_id}", response_model=ExceptionRead)
def exception_detail(exception_id: int, session: Db, user: Analyst):
    exception = get_exception(session, exception_id)
    if exception is None:
        raise HTTPException(status_code=404, detail="Exception not found")
    return exception


@router.patch("/exceptions/{exception_id}", response_model=ExceptionRead)
def update_exception(
    exception_id: int,
    request: ExceptionUpdate,
    session: Db,
    user: Analyst,
):
    try:
        exception = transition_exception(
            session,
            exception_id,
            request.status,
            resolution_reason=request.resolution_reason,
            user_id=user.id,
        )
        session.commit()
        session.refresh(exception)
        return exception
    except LookupError as exc:
        session.rollback()
        raise HTTPException(status_code=404, detail=str(exc)) from None
    except ValueError as exc:
        session.rollback()
        raise HTTPException(status_code=422, detail=str(exc)) from None


@router.get("/audit-logs", response_model=Page[AuditLogRead])
def audit_logs(
    session: Db,
    user: Analyst,
    offset: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    entity_type: str | None = Query(None, max_length=80),
):
    rows, total = list_audit_logs(session, offset=offset, limit=limit, entity_type=entity_type)
    return {"items": [AuditLogRead.model_validate(row) for row in rows], "total": total, "offset": offset, "limit": limit}


@router.get("/dashboard/summary")
def dashboard(user: Analyst, session: Db):
    return dashboard_summary(session)


@router.get("/admin/users", response_model=list[UserRead])
def admin_list_users(
    session: Db,
    user: Admin,
    offset: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
):
    return list_users(session, offset=offset, limit=limit)


@router.post("/admin/users", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def admin_create_user(request: UserCreate, session: Db, user: Admin):
    try:
        created = create_user(
            session,
            email=request.email,
            full_name=request.full_name,
            password=request.password,
            role=request.role,
        )
        session.commit()
        session.refresh(created)
        return created
    except ValueError as exc:
        session.rollback()
        raise HTTPException(status_code=409, detail=str(exc)) from None


@router.patch("/admin/users/{user_id}", response_model=UserRead)
def admin_update_user(user_id: int, request: UserUpdate, session: Db, user: Admin):
    try:
        updated = update_user(session, user_id, request.model_dump(exclude_unset=True))
        session.commit()
        session.refresh(updated)
        return updated
    except LookupError as exc:
        session.rollback()
        raise HTTPException(status_code=404, detail=str(exc)) from None
    except ValueError as exc:
        session.rollback()
        raise HTTPException(status_code=409, detail=str(exc)) from None


@router.get("/admin/config", response_model=list[ConfigRead])
def admin_config(session: Db, user: Admin):
    return [{"key": entry.key, "value": entry.value, "updated_at": entry.updated_at} for entry in list_config(session)]


@router.put("/admin/config/{key}")
def admin_set_config(key: str, request: ConfigUpdate, session: Db, user: Admin):
    try:
        setting = set_config(session, key, request.value, user.id)
        session.commit()
        session.refresh(setting)
        return {"key": setting.key, "value": setting.value, "updated_at": setting.updated_at}
    except ValueError as exc:
        session.rollback()
        raise HTTPException(status_code=422, detail=str(exc)) from None


@router.get("/health")
def health():
    if engine is None:
        raise HTTPException(status_code=503, detail="Database is not configured")
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
    except Exception:
        raise HTTPException(status_code=503, detail="Database is unavailable") from None
    return {"status": "ok"}
