"""Core FinanceFlow relational models."""

from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    JSON,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


class User(TimestampMixin, Base):
    __tablename__ = "users"
    __table_args__ = (CheckConstraint("role IN ('ANALYST', 'ADMIN')", name="ck_users_role"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String(320), unique=True, nullable=False, index=True)
    full_name: Mapped[str] = mapped_column(String(200), nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(nullable=False, default=True, server_default="true")
    role: Mapped[str] = mapped_column(String(16), nullable=False, default="ANALYST", server_default="ANALYST")


class AppConfig(TimestampMixin, Base):
    __tablename__ = "system_configs"

    key: Mapped[str] = mapped_column(String(100), primary_key=True)
    value: Mapped[dict | list | str | int | float | bool | None] = mapped_column(JSON, nullable=True)
    updated_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))


class Customer(TimestampMixin, Base):
    __tablename__ = "customers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    external_ref: Mapped[str | None] = mapped_column(String(100), unique=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    email: Mapped[str | None] = mapped_column(String(320), index=True)


class Account(TimestampMixin, Base):
    __tablename__ = "accounts"
    __table_args__ = (CheckConstraint("balance >= 0", name="ck_accounts_balance_nonnegative"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    customer_id: Mapped[int] = mapped_column(ForeignKey("customers.id", ondelete="RESTRICT"), nullable=False, index=True)
    account_number: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="USD", server_default="USD")
    balance: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=Decimal("0.00"))
    status: Mapped[str] = mapped_column(String(24), nullable=False, default="active", server_default="active")


class Transaction(TimestampMixin, Base):
    __tablename__ = "transactions"
    __table_args__ = (
        CheckConstraint("amount > 0", name="ck_transactions_amount_positive"),
        CheckConstraint("from_account_id IS NULL OR to_account_id IS NULL OR from_account_id <> to_account_id", name="ck_transactions_distinct_accounts"),
        Index("ix_transactions_status_created_at", "status", "created_at"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    reference: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    from_account_id: Mapped[int | None] = mapped_column(ForeignKey("accounts.id", ondelete="RESTRICT"), index=True)
    to_account_id: Mapped[int | None] = mapped_column(ForeignKey("accounts.id", ondelete="RESTRICT"), index=True)
    amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False)
    transaction_type: Mapped[str] = mapped_column(String(32), nullable=False, default="sale", server_default="sale")
    transaction_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(String(24), nullable=False, default="pending", server_default="pending")
    description: Mapped[str | None] = mapped_column(Text)


class ValidationResult(TimestampMixin, Base):
    __tablename__ = "validation_results"
    __table_args__ = (Index("ix_validation_results_transaction_status", "transaction_id", "status"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    transaction_id: Mapped[int | None] = mapped_column(ForeignKey("transactions.id", ondelete="CASCADE"))
    transaction_reference: Mapped[str | None] = mapped_column(String(100), index=True)
    source_row: Mapped[int | None] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(24), nullable=False)
    rule_name: Mapped[str] = mapped_column(String(120), nullable=False)
    details: Mapped[dict | None] = mapped_column(JSON)


class ReconciliationResult(TimestampMixin, Base):
    __tablename__ = "reconciliation_results"
    __table_args__ = (Index("ix_reconciliation_results_transaction_status", "transaction_id", "status"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    transaction_id: Mapped[int | None] = mapped_column(ForeignKey("transactions.id", ondelete="CASCADE"))
    transaction_reference: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(24), nullable=False)
    source_reference: Mapped[str | None] = mapped_column(String(120))
    source_amount: Mapped[Decimal | None] = mapped_column(Numeric(18, 2))
    ledger_amount: Mapped[Decimal | None] = mapped_column(Numeric(18, 2))
    difference: Mapped[Decimal | None] = mapped_column(Numeric(18, 2))
    details: Mapped[dict | None] = mapped_column(JSON)


class ExceptionRecord(TimestampMixin, Base):
    __tablename__ = "exceptions"
    __table_args__ = (
        Index("ix_exceptions_status_severity", "status", "severity"),
        Index("ix_exceptions_status_priority", "status", "priority"),
        CheckConstraint("status IN ('OPEN', 'UNDER_REVIEW', 'RESOLVED')", name="ck_exceptions_status"),
        CheckConstraint("priority IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')", name="ck_exceptions_priority"),
        CheckConstraint("status <> 'RESOLVED' OR (resolution_reason IS NOT NULL AND length(trim(resolution_reason)) > 0)", name="ck_exceptions_resolution_reason"),
        UniqueConstraint("source_key", name="uq_exceptions_source_key"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    transaction_id: Mapped[int | None] = mapped_column(ForeignKey("transactions.id", ondelete="SET NULL"), index=True)
    customer_id: Mapped[int | None] = mapped_column(ForeignKey("customers.id", ondelete="SET NULL"), index=True)
    transaction_reference: Mapped[str | None] = mapped_column(String(100), index=True)
    source_key: Mapped[str | None] = mapped_column(String(240))
    exception_type: Mapped[str] = mapped_column(String(80), nullable=False, default="PROCESSING_FAILURE", server_default="PROCESSING_FAILURE")
    source_amount: Mapped[Decimal | None] = mapped_column(Numeric(18, 2))
    ledger_amount: Mapped[Decimal | None] = mapped_column(Numeric(18, 2))
    difference: Mapped[Decimal | None] = mapped_column(Numeric(18, 2))
    priority: Mapped[str] = mapped_column(String(16), nullable=False, default="MEDIUM", server_default="MEDIUM")
    reason: Mapped[str] = mapped_column(Text, nullable=False, default="", server_default="")
    resolution_reason: Mapped[str | None] = mapped_column(Text)
    severity: Mapped[str] = mapped_column(String(16), nullable=False, default="medium", server_default="medium")
    status: Mapped[str] = mapped_column(String(24), nullable=False, default="OPEN", server_default="OPEN")
    description: Mapped[str] = mapped_column(Text, nullable=False)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class AuditLog(Base):
    __tablename__ = "audit_logs"
    __table_args__ = (Index("ix_audit_logs_entity", "entity_type", "entity_id"), Index("ix_audit_logs_created_at", "created_at"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)
    action: Mapped[str] = mapped_column(String(100), nullable=False)
    entity_type: Mapped[str] = mapped_column(String(80), nullable=False)
    entity_id: Mapped[str | None] = mapped_column(String(100))
    details: Mapped[dict | None] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
