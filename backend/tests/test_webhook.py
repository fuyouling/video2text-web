"""Paddle webhook: signature verification, fulfillment and idempotency."""
from __future__ import annotations

import hashlib
import hmac
import json

from app.core.db import SessionLocal
from app.models import License, Order, User


def _sign(body: bytes, secret: str, ts: str) -> str:
    signed = f"{ts}:{body.decode('utf-8')}".encode("utf-8")
    h1 = hmac.new(secret.encode(), signed, hashlib.sha256).hexdigest()
    return f"ts={ts};h1={h1}"


def _completed_event(event_id: str, txn_id: str, email: str) -> dict:
    return {
        "event_id": event_id,
        "event_type": "transaction.completed",
        "data": {
            "id": txn_id,
            "customer": {"id": "cus_1", "email": email},
            "currency_code": "USD",
            "details": {"totals": {"total": 990}},
            "items": [{"product_id": "pro", "price_id": "pri_1"}],
        },
    }


def _refund_event(event_id: str, txn_id: str) -> dict:
    return {
        "event_id": event_id,
        "event_type": "transaction.refunded",
        "data": {"id": txn_id},
    }


def _post(client, secret, event: dict):
    body = json.dumps(event).encode("utf-8")
    return client.post(
        "/webhooks/paddle",
        content=body,
        headers={
            "Content-Type": "application/json",
            "Paddle-Signature": _sign(body, secret, "1700000000"),
        },
    )


def test_webhook_issues_license_on_payment(client):
    secret = "test-webhook-secret"
    email = "buyer@webhook.test"
    resp = _post(client, secret, _completed_event("evt_paid_1", "txn_abc", email))
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        assert user is not None
        order = db.query(Order).filter(Order.paddle_order_id == "txn_abc").first()
        assert order is not None
        lic = db.query(License).filter(License.order_id == order.id).first()
        assert lic is not None
        assert lic.status == "active"
    finally:
        db.close()


def test_webhook_idempotent(client):
    secret = "test-webhook-secret"
    # First delivery
    r1 = _post(client, secret, _completed_event("evt_dup_1", "txn_dup", "dup@webhook.test"))
    assert r1.status_code == 200
    # Second (duplicate) delivery must be acknowledged, not double-issued
    r2 = _post(client, secret, _completed_event("evt_dup_1", "txn_dup", "dup@webhook.test"))
    assert r2.status_code == 200
    assert r2.json().get("duplicate") is True

    db = SessionLocal()
    try:
        assert db.query(License).join(Order).filter(
            Order.paddle_order_id == "txn_dup"
        ).count() == 1
    finally:
        db.close()


def test_webhook_invalid_signature_rejected(client):
    secret = "test-webhook-secret"
    body = json.dumps(_completed_event("evt_bad", "txn_bad", "x@y.z")).encode()
    resp = client.post(
        "/webhooks/paddle",
        content=body,
        headers={
            "Content-Type": "application/json",
            "Paddle-Signature": "ts=1;h1=deadbeef",
        },
    )
    assert resp.status_code == 401


def test_webhook_refund_revokes_license(client):
    secret = "test-webhook-secret"
    email = "refund@webhook.test"
    _post(client, secret, _completed_event("evt_rf_1", "txn_rf", email))
    r = _post(client, secret, _refund_event("evt_rf_2", "txn_rf"))
    assert r.status_code == 200

    db = SessionLocal()
    try:
        order = db.query(Order).filter(Order.paddle_order_id == "txn_rf").first()
        lic = db.query(License).filter(License.order_id == order.id).first()
        assert lic.status == "refunded"
    finally:
        db.close()
