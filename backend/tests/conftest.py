"""Pytest fixtures.

Sets required environment variables BEFORE importing the application, so the
``settings`` singleton and the SQLAlchemy engine are bound to an isolated
temporary database. Uses an in-memory signature key and empty mail key (the
mail service logs instead of sending when no key is configured).
"""
from __future__ import annotations

import base64
import os
import tempfile

# --- Must be set before importing app.* ------------------------------- #
os.environ.setdefault("APP_ENV", "test")
os.environ.setdefault("JWT_SECRET", "test-jwt-secret")
os.environ.setdefault(
    "LICENSE_ED25519_PRIVATE_KEY", base64.b64encode(os.urandom(32)).decode()
)
os.environ.setdefault("PADDLE_API_KEY", "test-paddle-key")
os.environ.setdefault("PADDLE_WEBHOOK_SECRET", "test-webhook-secret")
os.environ.setdefault("MAIL_API_KEY", "")  # dev fallback -> logs, no network

_tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
os.environ["DB_URL"] = f"sqlite:///{_tmp.name}"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402

from app.core.db import SessionLocal, init_db  # noqa: E402
from app.main import create_app  # noqa: E402


@pytest.fixture()
def client() -> TestClient:
    init_db()
    app = create_app()
    with TestClient(app) as c:
        yield c


@pytest.fixture()
def db() -> Session:
    init_db()
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()
