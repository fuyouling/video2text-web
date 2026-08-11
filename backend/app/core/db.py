"""Database engine, session factory and base declarative class.

Uses SQLAlchemy 2.x typed mappings. SQLite is the default for small / single
node deployments; swap ``db_url`` for a Postgres URL in production.
"""
from __future__ import annotations

from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import (
    DeclarativeBase,
    Session,
    sessionmaker,
)

from app.core.config import settings

connect_args = (
    {"check_same_thread": False} if settings.db_url.startswith("sqlite") else {}
)

engine = create_engine(
    settings.db_url,
    future=True,
    pool_pre_ping=True,
    connect_args=connect_args,
)

SessionLocal = sessionmaker(
    bind=engine, autoflush=False, expire_on_commit=False, future=True
)


class Base(DeclarativeBase):
    """Declarative base for all ORM models."""


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency yielding a request-scoped session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """Create all tables from metadata (dev / SQLite).

    Production schema is managed by Alembic migrations; this is a convenience
    for local development and tests.
    """
    # Import models so they register on Base.metadata before create_all.
    from app import models  # noqa: F401

    Base.metadata.create_all(bind=engine)
