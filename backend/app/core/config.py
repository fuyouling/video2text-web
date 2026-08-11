"""Application configuration loaded from environment / .env.

Only public, non-secret values have defaults. Secret values (JWT secret,
Ed25519 private key, Paddle keys, mail key) MUST be provided via the
environment — never hard-coded or committed.
"""
from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        populate_by_name=True,
    )

    # Service
    app_env: Literal["development", "production", "test"] = "production"

    # CORS allow-list (frontend site domains only).
    frontend_origins: list[str] = Field(
        default_factory=lambda: [
            "https://video2text.dpdns.org",
            "https://www.video2text.dpdns.org",
        ],
        alias="FRONTEND_ORIGINS",
    )

    # Database
    db_url: str = Field(default="sqlite:///./data/app.db", alias="DB_URL")

    # Auth / JWT
    jwt_secret: str = Field(alias="JWT_SECRET")
    jwt_algorithm: str = "HS256"
    access_token_ttl_minutes: int = 60 * 24 * 7

    # License signing (Ed25519). Stored as base64 of the 32-byte seed.
    license_private_key: str = Field(alias="LICENSE_ED25519_PRIVATE_KEY")

    # Payments (Paddle, Merchant of Record)
    paddle_api_key: str = Field(alias="PADDLE_API_KEY")
    paddle_webhook_secret: str = Field(alias="PADDLE_WEBHOOK_SECRET")
    paddle_environment: Literal["sandbox", "production"] = Field(
        default="sandbox", alias="PADDLE_ENVIRONMENT"
    )
    paddle_vendor_id: str | None = Field(default=None, alias="PADDLE_VENDOR_ID")

    # Transactional email
    mail_api_key: str = Field(alias="MAIL_API_KEY")
    mail_from: str = Field(
        default="licensing@video2text.dpdns.org", alias="MAIL_FROM"
    )

    # Rate limiting (single-worker only; use Redis/DB count for multi-worker).
    activation_rate_limit_per_ip: int = Field(
        default=20, alias="ACTIVATION_RATE_LIMIT_PER_IP"
    )

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"


@lru_cache
def get_settings() -> Settings:
    """Cached settings instance (re-evaluated only after clear_cache())."""
    return Settings()


# Module-level singleton used throughout the app.
settings = get_settings()
