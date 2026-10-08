import os

from fastapi import FastAPI, HTTPException, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from sqlalchemy import text
from starlette.middleware.cors import CORSMiddleware
from starlette.responses import JSONResponse

from database import engine
from api.routes import router as api_router
from processing.routes import router as processing_router

app = FastAPI(title="FinanceFlow API")

environment = os.getenv("APP_ENV", "development").strip().lower()
configured_origins = [
    origin.strip().rstrip("/")
    for origin in os.getenv("CORS_ALLOWED_ORIGINS", "").split(",")
    if origin.strip()
]
if environment == "production":
    if not configured_origins or "*" in configured_origins:
        raise RuntimeError("CORS_ALLOWED_ORIGINS must contain explicit production frontend origins")
    if engine is None:
        raise RuntimeError("DATABASE_URL must be configured in production")
    if len(os.getenv("AUTH_SECRET_KEY", "").encode("utf-8")) < 32:
        raise RuntimeError("AUTH_SECRET_KEY must be configured with at least 32 characters in production")
else:
    configured_origins = configured_origins or [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
    ]

if any(origin == "*" for origin in configured_origins):
    raise RuntimeError("CORS_ALLOWED_ORIGINS does not accept wildcard origins")

app.add_middleware(
    CORSMiddleware,
    allow_origins=configured_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
)


@app.exception_handler(RequestValidationError)
async def request_validation_error(request: Request, exc: RequestValidationError):
    errors = exc.errors()
    for error in errors:
        sensitive_fields = {"password", "password_hash", "secret", "token"}
        if any(
            isinstance(part, str) and part.lower() in sensitive_fields
            for part in error.get("loc", ())
        ):
            error["input"] = "[redacted]"
    return JSONResponse(status_code=422, content={"detail": jsonable_encoder(errors)})


app.include_router(api_router)
app.include_router(processing_router)

@app.get("/")
def root():
    return {"message": "FinanceFlow API is running"}


@app.get("/health/db")
def database_health():
    if engine is None:
        raise HTTPException(status_code=503, detail="Database is not configured")
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
    except Exception:
        raise HTTPException(status_code=503, detail="Database is unavailable") from None
    return {"database": "ok"}
