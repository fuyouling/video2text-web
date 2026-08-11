"""FastAPI application factory.

Assembles routers, CORS, and unified exception handling. Sensitive logic
(auth, license signing, payment verification) lives in core/services; this
module only wires things together.
"""
from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api import health, license, users, webhooks
from app.core.config import settings
from app.core.db import Base, engine, init_db
from app.core.errors import AppError
from app.core.logging import configure_logging, get_logger

logger = get_logger("video2text.main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Dev / small deployments: create schema if missing. Production runs
    # Alembic migrations; create_all is a no-op when tables already exist.
    init_db()
    _seed_plans()
    yield


def _seed_plans() -> None:
    """Ensure the default 'pro' plan exists (idempotent)."""
    from app.models import Plan
    from sqlalchemy import select
    from sqlalchemy.orm import Session

    with Session(engine) as db:
        if db.scalar(select(Plan).where(Plan.id == "pro")) is None:
            db.add(
                Plan(
                    id="pro",
                    name="Pro",
                    price_cents=990,
                    currency="USD",
                    billing_type="one-time",
                    features_json='["batch","incremental_plus","priority_support"]',
                    max_devices=2,
                )
            )
            db.commit()


def create_app() -> FastAPI:
    configure_logging("DEBUG" if settings.app_env != "production" else "INFO")

    app = FastAPI(
        title="video2text API",
        version="1.0.0",
        description="License issuance, activation and Paddle webhook handling.",
        lifespan=lifespan,
    )

    configure_cors(app, settings.frontend_origins)
    register_exception_handlers(app)

    app.include_router(health.router)
    app.include_router(users.router)
    app.include_router(license.router)
    app.include_router(webhooks.router)

    return app


def configure_cors(app: FastAPI, origins: list[str]) -> None:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "Paddle-Signature"],
    )


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def _app_error(_: Request, exc: AppError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content={"error": {"code": exc.code, "message": exc.message}},
        )

    @app.exception_handler(RequestValidationError)
    async def _validation_error(_: Request, exc: RequestValidationError) -> JSONResponse:
        return JSONResponse(
            status_code=422,
            content={"error": {"code": "validation_error", "message": "Invalid request payload"}},
        )

    @app.exception_handler(Exception)
    async def _unhandled(_: Request, exc: Exception) -> JSONResponse:
        logger.error("Unhandled error: %s", exc)
        return JSONResponse(
            status_code=500,
            content={"error": {"code": "internal_error", "message": "Internal server error"}},
        )
