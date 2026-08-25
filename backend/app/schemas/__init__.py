"""Pydantic request / response schemas."""
from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, EmailStr, Field

# --------------------------------------------------------------------------- #
# Auth
# --------------------------------------------------------------------------- #
class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"


# --------------------------------------------------------------------------- #
# License
# --------------------------------------------------------------------------- #
class LicenseActivateRequest(BaseModel):
    key: str = Field(min_length=8, max_length=64)
    machine_id_hash: str = Field(min_length=8, max_length=128)


class LicenseActivateResponse(BaseModel):
    license_id: str
    license_token: str
    plan: str
    entitlements: list[str]
    recheck_after: datetime


class LicenseVerifyRequest(BaseModel):
    license_id: str = Field(min_length=1, max_length=64)
    machine_id_hash: str = Field(min_length=8, max_length=128)


class LicenseVerifyResponse(BaseModel):
    status: str
    recheck_after: datetime | None = None


# --------------------------------------------------------------------------- #
# Webhook
# --------------------------------------------------------------------------- #
class PaddleWebhookEnvelope(BaseModel):
    event_id: str
    event_type: str
    data: dict


# --------------------------------------------------------------------------- #
# Responses (safe projections — never leak internal fields)
# --------------------------------------------------------------------------- #
class DeviceOut(BaseModel):
    id: int
    machine_id_hash: str
    first_seen_at: datetime
    last_active_at: datetime
    revoked_at: datetime | None = None


class LicenseOut(BaseModel):
    id: int
    status: str
    max_devices: int
    created_at: datetime
    devices: list[DeviceOut] = []


class PlanOut(BaseModel):
    id: str
    name: str
    price_cents: int
    currency: str
    billing_type: str
    max_devices: int


class OrderOut(BaseModel):
    id: int
    paddle_order_id: str
    plan_id: str
    amount_cents: int
    currency: str
    status: str
    created_at: datetime


class UserOut(BaseModel):
    id: int
    email: str
    created_at: datetime
