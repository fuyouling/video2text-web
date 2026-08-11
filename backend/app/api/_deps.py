"""Shared API dependencies: auth, client IP, rate limiting, signature verify."""
from __future__ import annotations

import time
from collections import defaultdict
from datetime import datetime, timezone

from fastapi import Depends, HTTPException, Request
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core import security
from app.core.config import settings
from app.core.errors import unauthorized
from app.core.logging import get_logger
from app.models import User
from app.core.db import get_db

logger = get_logger("video2text.deps")

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


# --------------------------------------------------------------------------- #
# Current user
# --------------------------------------------------------------------------- #
def get_current_user(
    token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)
) -> User:
    try:
        payload = security.decode_access_token(token)
        sub = payload.get("sub")
        if not sub:
            raise ValueError("missing sub")
    except Exception:
        unauthorized("Invalid or expired token")
    user = db.get(User, int(sub)) if str(sub).isdigit() else None
    if user is None:
        unauthorized("User no longer exists")
    return user


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
        from app.core.errors import too_many_requests

        too_many_requests()
    window.append(now)


# --------------------------------------------------------------------------- #
# Paddle signature delegation
# --------------------------------------------------------------------------- #
def verify_paddle_signature(raw_body: bytes, signature_header: str | None) -> bool:
    return security.verify_paddle_signature(
        raw_body, signature_header, settings.paddle_webhook_secret
    )
