"""SQLAlchemy ORM models.

Six tables: User, Plan, Order, License, Device, WebhookEvent.
Only license keys and machine ids are stored as hashes; amounts are stored as
integer minor units (cents) to avoid float errors.
"""
from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
    select,
)
from sqlalchemy.orm import Mapped, mapped_column, object_session, relationship

from app.core.db import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    paddle_customer_id: Mapped[str | None] = mapped_column(String(120), nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    licenses: Mapped[list["License"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )


class Plan(Base):
    __tablename__ = "plans"

    id: Mapped[str] = mapped_column(String(40), primary_key=True)  # e.g. "pro"
    name: Mapped[str] = mapped_column(String(120))
    price_cents: Mapped[int] = mapped_column(Integer)
    currency: Mapped[str] = mapped_column(String(8), default="USD")
    billing_type: Mapped[str] = mapped_column(String(20), default="one-time")
    features_json: Mapped[str] = mapped_column(Text, default="[]")
    max_devices: Mapped[int] = mapped_column(Integer, default=2)


class Order(Base):
    __tablename__ = "orders"
    __table_args__ = (UniqueConstraint("paddle_order_id", name="uq_orders_paddle"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    paddle_order_id: Mapped[str] = mapped_column(String(120))
    plan_id: Mapped[str] = mapped_column(String(40))
    amount_cents: Mapped[int] = mapped_column(Integer)
    currency: Mapped[str] = mapped_column(String(8), default="USD")
    status: Mapped[str] = mapped_column(String(20), default="paid")  # paid|refunded
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    license: Mapped["License | None"] = relationship(back_populates="order")


class License(Base):
    __tablename__ = "licenses"
    __table_args__ = (UniqueConstraint("key_hash", name="uq_licenses_key_hash"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    order_id: Mapped[int | None] = mapped_column(
        ForeignKey("orders.id"), nullable=True, index=True
    )
    key_hash: Mapped[str] = mapped_column(String(64))  # SHA-256 hex
    status: Mapped[str] = mapped_column(String(20), default="active")  # active|revoked|refunded
    max_devices: Mapped[int] = mapped_column(Integer, default=2)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    user: Mapped["User"] = relationship(back_populates="licenses")
    order: Mapped["Order | None"] = relationship(back_populates="license")
    devices: Mapped[list["Device"]] = relationship(
        back_populates="license", cascade="all, delete-orphan"
    )

    def is_active(self) -> bool:
        return self.status == "active"

    def active_device_count(self) -> int:
        session = object_session(self)
        if session is None:
            return sum(1 for d in self.devices if d.revoked_at is None)
        return int(
            session.scalar(
                select(func.count(Device.id)).where(
                    Device.license_id == self.id,
                    Device.revoked_at.is_(None),
                )
            )
            or 0
        )


class Device(Base):
    __tablename__ = "devices"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    license_id: Mapped[int] = mapped_column(ForeignKey("licenses.id"), index=True)
    machine_id_hash: Mapped[str] = mapped_column(String(64), index=True)
    first_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    last_active_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    license: Mapped["License"] = relationship(back_populates="devices")


class WebhookEvent(Base):
    __tablename__ = "webhook_events"
    __table_args__ = (UniqueConstraint("event_id", name="uq_webhook_event_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    provider: Mapped[str] = mapped_column(String(20), default="paddle")  # paddle
    event_id: Mapped[str] = mapped_column(String(120))  # idempotency key
    type: Mapped[str] = mapped_column(String(80))
    payload_json: Mapped[str] = mapped_column(Text)
    processed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
