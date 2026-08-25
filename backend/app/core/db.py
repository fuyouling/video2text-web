"""Database engine, session factory and base declarative class.

Uses SQLAlchemy 2.x typed mappings with MySQL (PyMySQL driver) in
production and local dev. ``db_url`` is env-driven; tests point at SQLite.
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

# SQLite needs check_same_thread disabled for multi-thread access; MySQL
# (pymysql) needs pool_recycle below the server's wait_timeout (default 28800s)
# so idle connections are not killed mid-request. pool_pre_ping validates a
# connection before handing it out.
is_sqlite = settings.db_url.startswith("sqlite")
connect_args = {"check_same_thread": False} if is_sqlite else {}

engine = create_engine(
    settings.db_url,
    future=True,
    pool_pre_ping=True,
    pool_recycle=3600 if not is_sqlite else -1,
    pool_size=10 if not is_sqlite else 5,
    max_overflow=20 if not is_sqlite else 10,
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
    """Create all tables from metadata (dev / test convenience).

    Production schema is managed by Alembic migrations; this is a convenience
    for local development and tests.
    """
    # Import models so they register on Base.metadata before create_all.
    from app import models  # noqa: F401

    Base.metadata.create_all(bind=engine)
