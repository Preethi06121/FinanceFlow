"""Pydantic request and response schemas for the FinanceFlow API."""

from datetime import datetime
from decimal import Decimal
from typing import Any, Generic, Literal, TypeVar

from pydantic import BaseModel, ConfigDict, Field, SecretStr, field_validator

T = TypeVar("T")


class Page(BaseModel, Generic[T]):
    items: list[T]
    total: int
    offset: int
    limit: int


class LoginRequest(BaseModel):
    email: str
    password: str = Field(min_length=1, max_length=1024)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        normalized = value.strip().lower()
        if "@" not in normalized or normalized.startswith("@") or normalized.endswith("@"):
            raise ValueError("A valid email address is required")
        return normalized


class RegisterRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    full_name: str = Field(min_length=1, max_length=200)
    email: str = Field(max_length=320)
    password: SecretStr = Field(min_length=12, max_length=256)

    @field_validator("full_name")
    @classmethod
    def normalize_full_name(cls, value: str) -> str:
        name = value.strip()
        if not name:
            raise ValueError("Name is required")
        return name

    @field_validator("email")
    @classmethod
    def normalize_registration_email(cls, value: str) -> str:
        normalized = value.strip().lower()
        local, separator, domain = normalized.partition("@")
        if (
            not separator
            or not local
            or not domain
            or "." not in domain
            or any(character.isspace() for character in normalized)
        ):
            raise ValueError("A valid email address is required")
        return normalized

    @field_validator("password")
    @classmethod
    def validate_registration_password(cls, value: SecretStr) -> SecretStr:
        length = len(value.get_secret_value())
        if length < 12:
            raise ValueError("Password must contain at least 12 characters")
        if length > 256:
            raise ValueError("Password must contain no more than 256 characters")
        return value


class LoginResponse(BaseModel):
    access_token: str
    token_type: Literal["bearer"] = "bearer"
    expires_in: int
    user_id: int
    email: str
    role: Literal["ANALYST", "ADMIN"]


class UserCreate(BaseModel):
    email: str
    full_name: str = Field(min_length=1, max_length=200)
    password: str = Field(min_length=12, max_length=256)
    role: Literal["ANALYST", "ADMIN"] = "ANALYST"

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        normalized = value.strip().lower()
        if "@" not in normalized or normalized.startswith("@") or normalized.endswith("@"):
            raise ValueError("A valid email address is required")
        return normalized


class UserUpdate(BaseModel):
    role: Literal["ANALYST", "ADMIN"] | None = None
    is_active: bool | None = None
    password: str | None = Field(default=None, min_length=12, max_length=256)


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    full_name: str
    role: Literal["ANALYST", "ADMIN"]
    is_active: bool
    created_at: datetime


class TransactionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    reference: str
    from_account_id: int | None
    to_account_id: int | None
    amount: Decimal
    currency: str
    transaction_type: str
    transaction_date: datetime | None
    status: str
    description: str | None
    created_at: datetime
    updated_at: datetime


class ReconciliationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    transaction_id: int | None
    transaction_reference: str
    status: str
    source_reference: str | None
    source_amount: Decimal | None
    ledger_amount: Decimal | None
    difference: Decimal | None
    details: dict[str, Any] | None
    created_at: datetime


class ExceptionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    transaction_id: int | None
    customer_id: int | None
    transaction_reference: str | None
    exception_type: str
    source_amount: Decimal | None
    ledger_amount: Decimal | None
    difference: Decimal | None
    priority: str
    status: str
    reason: str
    resolution_reason: str | None
    resolved_at: datetime | None
    created_at: datetime
    updated_at: datetime


class ExceptionUpdate(BaseModel):
    status: Literal["UNDER_REVIEW", "RESOLVED"]
    resolution_reason: str | None = Field(default=None, max_length=4000)


class AuditLogRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int | None
    action: str
    entity_type: str
    entity_id: str | None
    details: dict[str, Any] | None
    created_at: datetime


class ConfigUpdate(BaseModel):
    value: Any


class ConfigRead(BaseModel):
    key: str
    value: Any
    updated_at: datetime
