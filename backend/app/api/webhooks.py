"""Paddle webhook receiver (verified + idempotent)."""
from __future__ import annotations

import json

from fastapi import APIRouter, Request

from app.api._deps import verify_paddle_signature
from app.core.db import SessionLocal
from app.core.errors import unauthorized
from app.core.logging import get_logger
from app.services.license_service import LicenseService
from app.services.mail_service import MailService
from app.services.payment_service import PaymentService

logger = get_logger("video2text.webhooks")

router = APIRouter(tags=["webhooks"])


@router.post("/webhooks/paddle")
async def paddle_webhook(request: Request) -> dict:
    raw_body = await request.body()
    signature_header = request.headers.get("paddle-signature")

    if not verify_paddle_signature(raw_body, signature_header):
        unauthorized("Invalid webhook signature")

    try:
        envelope = json.loads(raw_body)
    except json.JSONDecodeError:
        unauthorized("Malformed webhook payload")

    event_id = envelope.get("event_id") or envelope.get("id")
    event_type = envelope.get("event_type") or envelope.get("name") or "unknown"
    data = envelope.get("data", {})

    if not event_id:
        unauthorized("Missing event id")

    db = SessionLocal()
    try:
        svc = PaymentService(
            db=db,
            license_svc=LicenseService(db),
            mail_svc=MailService(),
        )
        # Idempotency: record first, process once.
        if svc.is_event_processed(event_id):
            logger.info("Duplicate webhook %s — acknowledged", event_id)
            return {"status": "ok", "duplicate": True}

        svc.record_event(
            provider="paddle", event_id=event_id, type=event_type, payload=data
        )
        svc.dispatch(event_type, data)
    except Exception as exc:  # never leak internals; Paddle retries on non-2xx
        logger.error("Webhook %s processing failed: %s", event_id, exc)
        raise
    finally:
        db.close()

    return {"status": "ok"}
