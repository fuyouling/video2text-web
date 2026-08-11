"""Payment (Paddle MoR) webhook handling and order/license fulfillment.

Webhooks are verified and de-duplicated (idempotent) before any state change.
All money values are integer minor units (cents).
"""
from __future__ import annotations

import json
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core import security
from app.core.errors import not_found
from app.core.logging import get_logger
from app.models import License, Order, Plan, User, WebhookEvent
from app.services.license_service import LicenseService
from app.services.mail_service import MailService

logger = get_logger("video2text.payment")

# Map Paddle product/price ids to internal plan ids. Only "pro" exists today.
PRODUCT_TO_PLAN: dict[str, str] = {}


class PaymentService:
    def __init__(self, db: Session, license_svc: LicenseService, mail_svc: MailService):
        self.db = db
        self.license_svc = license_svc
        self.mail_svc = mail_svc

    # ------------------------------------------------------------------ #
    # Idempotency
    # ------------------------------------------------------------------ #
    def is_event_processed(self, event_id: str) -> bool:
        return (
            self.db.scalar(
                select(WebhookEvent.id).where(WebhookEvent.event_id == event_id)
            )
            is not None
        )

    def record_event(
        self, *, provider: str, event_id: str, type: str, payload: dict
    ) -> WebhookEvent:
        event = WebhookEvent(
            provider=provider,
            event_id=event_id,
            type=type,
            payload_json=json.dumps(payload, default=str),
            processed_at=datetime.now(timezone.utc),
        )
        self.db.add(event)
        self.db.commit()
        return event

    # ------------------------------------------------------------------ #
    # User / order upserts
    # ------------------------------------------------------------------ #
    def upsert_user_by_email(self, email: str, paddle_customer_id: str | None) -> User:
        user = self.db.scalar(select(User).where(User.email == email))
        if user is None:
            user = User(email=email, paddle_customer_id=paddle_customer_id)
            self.db.add(user)
            self.db.commit()
            self.db.refresh(user)
        elif paddle_customer_id and user.paddle_customer_id != paddle_customer_id:
            user.paddle_customer_id = paddle_customer_id
            self.db.commit()
        return user

    def upsert_order(
        self, *, paddle_order_id: str, user: User, plan_id: str, amount_cents: int, currency: str
    ) -> Order:
        order = self.db.scalar(
            select(Order).where(Order.paddle_order_id == paddle_order_id)
        )
        if order is None:
            order = Order(
                user_id=user.id,
                paddle_order_id=paddle_order_id,
                plan_id=plan_id,
                amount_cents=amount_cents,
                currency=currency,
                status="paid",
            )
            self.db.add(order)
            self.db.commit()
            self.db.refresh(order)
        return order

    # ------------------------------------------------------------------ #
    # Event handlers
    # ------------------------------------------------------------------ #
    def handle_transaction_completed(self, data: dict) -> None:
        paddle_order_id = data.get("id")
        if not paddle_order_id:
            logger.warning("transaction.completed missing id; skipping")
            return

        customer = data.get("customer") or {}
        email = customer.get("email")
        if not email:
            logger.warning("transaction.completed missing customer email; skipping")
            return

        plan_id = self._resolve_plan_id(data)
        amount, currency = self._extract_amount(data)

        user = self.upsert_user_by_email(email, customer.get("id"))
        order = self.upsert_order(
            paddle_order_id=paddle_order_id,
            user=user,
            plan_id=plan_id,
            amount_cents=amount,
            currency=currency,
        )

        existing = self.db.scalar(
            select(License).where(License.order_id == order.id)
        )
        if existing is not None:
            logger.info("License already issued for order %s; skipping", paddle_order_id)
            return

        plan = self.db.get(Plan, plan_id) or self._default_plan()
        key = security.generate_license_key()
        license = self.license_svc.issue_license(user=user, plan=plan, order=order, key=key)
        payload = self.license_svc.build_payload(license, machine_id_hash="")
        self.mail_svc.send_license_email(email=user.email, key=key, payload=payload)
        logger.info("Issued license %s for order %s", license.id, paddle_order_id)

    def handle_refund(self, data: dict) -> None:
        paddle_order_id = data.get("id") or (
            data.get("original_transaction_id")
        )
        if not paddle_order_id:
            logger.warning("refund event missing order id; skipping")
            return
        order = self.db.scalar(
            select(Order).where(Order.paddle_order_id == paddle_order_id)
        )
        if order is None:
            logger.warning("refund for unknown order %s; skipping", paddle_order_id)
            return
        order.status = "refunded"
        license = self.db.scalar(select(License).where(License.order_id == order.id))
        if license is not None:
            self.license_svc.revoke(license=license, reason="refund")
        user = self.db.get(User, order.user_id)
        self.db.commit()
        if user is not None:
            self.mail_svc.send_refund_notice(email=user.email, order_id=paddle_order_id)
        logger.info("Refunded order %s; license %s deactivated", paddle_order_id, license.id if license else None)

    def dispatch(self, event_type: str, data: dict) -> None:
        if event_type == "transaction.completed":
            self.handle_transaction_completed(data)
        elif event_type in ("transaction.refunded", "transaction.revoked"):
            self.handle_refund(data)
        else:
            logger.info("Ignoring unhandled event type: %s", event_type)

    # ------------------------------------------------------------------ #
    def _resolve_plan_id(self, data: dict) -> str:
        for item in data.get("items", []) or []:
            pid = item.get("product_id") or item.get("price_id")
            if pid and pid in PRODUCT_TO_PLAN:
                return PRODUCT_TO_PLAN[pid]
        return "pro"

    def _extract_amount(self, data: dict) -> tuple[int, str]:
        totals = (data.get("details") or {}).get("totals") or {}
        amount = int(totals.get("total", 0) or 0)
        currency = (data.get("currency_code") or "USD").upper()
        return amount, currency

    def _default_plan(self) -> Plan:
        plan = self.db.get(Plan, "pro")
        if plan is None:
            plan = Plan(
                id="pro",
                name="Pro",
                price_cents=990,
                currency="USD",
                billing_type="one-time",
                features_json=json.dumps(
                    ["batch", "incremental_plus", "priority_support"]
                ),
                max_devices=2,
            )
            self.db.add(plan)
            self.db.commit()
            self.db.refresh(plan)
        return plan
