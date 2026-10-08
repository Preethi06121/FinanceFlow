"""Password hashing and compact HS256 JWT support using the standard library."""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import secrets
import time
from typing import Any

PBKDF2_ROUNDS = 310_000
JWT_ALGORITHM = "HS256"


class TokenError(ValueError):
    pass


def hash_password(password: str) -> str:
    if len(password) < 12:
        raise ValueError("Password must contain at least 12 characters")
    salt = secrets.token_bytes(16)
    derived = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, PBKDF2_ROUNDS)
    return "$".join((
        "pbkdf2_sha256",
        str(PBKDF2_ROUNDS),
        base64.urlsafe_b64encode(salt).decode("ascii").rstrip("="),
        base64.urlsafe_b64encode(derived).decode("ascii").rstrip("="),
    ))


def verify_password(password: str, encoded: str) -> bool:
    try:
        algorithm, rounds_text, salt_text, expected_text = encoded.split("$", 3)
        if algorithm != "pbkdf2_sha256":
            return False
        rounds = int(rounds_text)
        if rounds < 100_000 or rounds > 2_000_000:
            return False
        salt = base64.urlsafe_b64decode(salt_text + "=" * (-len(salt_text) % 4))
        expected = base64.urlsafe_b64decode(expected_text + "=" * (-len(expected_text) % 4))
        actual = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, rounds)
        return hmac.compare_digest(actual, expected)
    except (ValueError, TypeError, AttributeError):
        return False


def _secret_key() -> bytes:
    value = os.getenv("AUTH_SECRET_KEY", "")
    if len(value.encode("utf-8")) < 32:
        raise RuntimeError("AUTH_SECRET_KEY must be configured in .env with at least 32 characters")
    return value.encode("utf-8")


def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("ascii").rstrip("=")


def _decode_segment(segment: str) -> bytes:
    return base64.urlsafe_b64decode(segment + "=" * (-len(segment) % 4))


def create_access_token(user_id: int, role: str, *, ttl_minutes: int | None = None) -> tuple[str, int]:
    ttl = ttl_minutes or int(os.getenv("AUTH_TOKEN_TTL_MINUTES", "30"))
    if ttl < 1 or ttl > 1440:
        raise ValueError("AUTH_TOKEN_TTL_MINUTES must be between 1 and 1440")
    now = int(time.time())
    header = {"alg": JWT_ALGORITHM, "typ": "JWT"}
    payload = {"sub": str(user_id), "role": role, "iat": now, "exp": now + ttl * 60}
    signing_input = f"{_b64url(json.dumps(header, separators=(',', ':')).encode())}.{_b64url(json.dumps(payload, separators=(',', ':')).encode())}"
    signature = hmac.new(_secret_key(), signing_input.encode("ascii"), hashlib.sha256).digest()
    return f"{signing_input}.{_b64url(signature)}", ttl * 60


def decode_access_token(token: str) -> dict[str, Any]:
    try:
        header_part, payload_part, signature_part = token.split(".")
        signing_input = f"{header_part}.{payload_part}"
        signature = _decode_segment(signature_part)
        expected = hmac.new(_secret_key(), signing_input.encode("ascii"), hashlib.sha256).digest()
        if not hmac.compare_digest(signature, expected):
            raise TokenError("Invalid token signature")
        header = json.loads(_decode_segment(header_part))
        claims = json.loads(_decode_segment(payload_part))
        if header.get("alg") != JWT_ALGORITHM or header.get("typ") != "JWT":
            raise TokenError("Unsupported token header")
        if not isinstance(claims.get("sub"), str) or not claims["sub"].isdigit():
            raise TokenError("Invalid token subject")
        if claims.get("role") not in {"ANALYST", "ADMIN"}:
            raise TokenError("Invalid token role")
        if int(claims.get("exp", 0)) <= int(time.time()):
            raise TokenError("Token has expired")
        if int(claims.get("iat", 0)) > int(time.time()) + 60:
            raise TokenError("Token issued in the future")
        return claims
    except TokenError:
        raise
    except (ValueError, TypeError, KeyError, json.JSONDecodeError, UnicodeDecodeError):
        raise TokenError("Invalid access token") from None
