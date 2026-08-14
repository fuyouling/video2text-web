"""Shared API dependencies: auth, client IP, rate limiting, signature verify."""
from __future__ import annotations

import time
from collections import defaultdict

from fastapi import Depends, HTTPException, Request
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core import security
from app.core.config import settings
from app.core.db import SessionLocal, get_db
from app.core.errors import too_many_requests, unauthorized
from app.core.logging import get_logger
from app.models import User

logger = get_logger("video2text.deps")

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

# Paths that never require a user token. Everything else is authenticated.
_PUBLIC_GET = {"/", "/health", "/docs", "/openapi.json", "/redoc"}
_PUBLIC_POST_PREFIXES = ("/auth/", "/license/", "/webhooks/")


# --------------------------------------------------------------------------- #
# Current user
# --------------------------------------------------------------------------- #
def resolve_user(token: str | None, db: Session) -> User | None:
    """Return the user for a bearer token, or ``None`` if invalid/missing."""
    if not token:
        return None
    try:
        payload = security.decode_access_token(token)
        sub = payload.get("sub")
        if not sub:
            return None
        return db.get(User, int(sub)) if str(sub).isdigit() else None
    except Exception:
        return None


def get_current_user(
    token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)
) -> User:
    user = resolve_user(token, db)
    if user is None:
        unauthorized("Invalid or expired token")
    return user


def enforce_auth(request: Request) -> None:
    """App-level guard: require a valid bearer token on protected routes.

    Public paths (health, docs, auth/license/webhook POSTs, CORS preflight)
    bypass the check; all other requests must be authenticated. Resolved user
    is stored on ``request.state.user`` for downstream use.
    """
    method = request.method
    path = request.url.path
    if method == "OPTIONS":
        return
    if method == "GET" and path in _PUBLIC_GET:
        return
    if method == "POST" and path.startswith(_PUBLIC_POST_PREFIXES):
        return

    auth = request.headers.get("authorization")
    token: str | None = None
    if auth and auth.lower().startswith("bearer "):
        token = auth.split(" ", 1)[1].strip()

    user: User | None = None
    if token:
        with SessionLocal() as db:
            user = resolve_user(token, db)
    if user is None:
        unauthorized("Authentication required")
    request.state.user = user


# --------------------------------------------------------------------------- #
# Client IP (Cloudflare / proxy aware)
# --------------------------------------------------------------------------- #
def get_client_ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


# --------------------------------------------------------------------------- #
# In-memory rate limit (single worker only)
# --------------------------------------------------------------------------- #
_hits: dict[str, list[float]] = defaultdict(list)
_WINDOW_SECONDS = 60.0


def rate_limit(
    ip: str = Depends(get_client_ip),
    limit: int = settings.activation_rate_limit_per_ip,
) -> None:
    now = time.monotonic()
    window = _hits[ip]
    window[:] = [t for t in window if now - t < _WINDOW_SECONDS]
    if len(window) >= limit:
        too_many_requests()
    window.append(now)


def rate_limit_auth(ip: str = Depends(get_client_ip)) -> None:
    """Stricter per-IP limit for credential endpoints (login/register)."""
    rate_limit(ip, settings.auth_rate_limit_per_ip)


# --------------------------------------------------------------------------- #
# Login brute-force protection (single worker only)
# --------------------------------------------------------------------------- #
_login_failures: dict[str, list[float]] = defaultdict(list)


def _login_window_seconds() -> float:
    return float(settings.login_lockout_minutes) * 60.0


def check_login_locked(email: str) -> None:
    """Raise 429 if the email exceeded max failed attempts in the window."""
    now = time.monotonic()
    fails = _login_failures.get(email, [])
    fails = [t for t in fails if now - t < _login_window_seconds()]
    _login_failures[email] = fails
    if len(fails) >= settings.login_max_attempts:
        too_many_requests(
            "Too many failed attempts, account temporarily locked. "
            "Try again later."
        )


def record_login_failure(email: str) -> None:
    _login_failures[email].append(time.monotonic())


def clear_login_failures(email: str) -> None:
    _login_failures.pop(email, None)


# --------------------------------------------------------------------------- #
# Paddle signature delegation
# --------------------------------------------------------------------------- #
def verify_paddle_signature(raw_body: bytes, signature_header: str | None) -> bool:
    return security.verify_paddle_signature(
        raw_body, signature_header, settings.paddle_webhook_secret
    )
