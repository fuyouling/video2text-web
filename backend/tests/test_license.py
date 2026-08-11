"""License state machine + activation / device-limit / revoke tests."""
from __future__ import annotations

import pytest
from sqlalchemy.orm import Session

from app.core.errors import AppError, conflict, not_found
from app.models import License, Plan, User
from app.services.license_service import LicenseService
from app.services.mail_service import MailService
from app.services.payment_service import PaymentService


def _make_user(db: Session, email: str = "buyer@example.com") -> User:
    u = User(email=email)
    db.add(u)
    db.commit()
    db.refresh(u)
    return u


def test_issue_and_activate(db: Session):
    user = _make_user(db)
    svc = LicenseService(db)
    plan = db.get(Plan, "pro")
    lic = svc.issue_license(user=user, plan=plan)
    assert lic.is_active()

    resp = svc.activate(key=lic._plaintext_key, machine_id_hash="machine-aaaaa")
    assert resp.plan == "pro"
    assert len(resp.entitlements) > 0
    # token verifies offline with the public key
    payload = __import__("app.core.security", fromlist=["security"]).verify_license_token(
        resp.license_token
    )
    assert payload["license_id"] == str(lic.id)


def test_activate_unknown_key_raises(db: Session):
    svc = LicenseService(db)
    with pytest.raises(AppError):
        svc.activate(key="V2T-PRO-ZZZZ-ZZZZ-ZZZZ", machine_id_hash="m1")


def test_device_limit_enforced(db: Session):
    user = _make_user(db, "multi@example.com")
    svc = LicenseService(db)
    plan = db.get(Plan, "pro")
    lic = svc.issue_license(user=user, plan=plan)

    svc.activate(key=lic._plaintext_key, machine_id_hash="m1")
    svc.activate(key=lic._plaintext_key, machine_id_hash="m2")
    assert lic.active_device_count() == 2

    with pytest.raises(AppError):
        svc.activate(key=lic._plaintext_key, machine_id_hash="m3")


def test_reactivate_existing_device_does_not_increase_count(db: Session):
    user = _make_user(db, "repeat@example.com")
    svc = LicenseService(db)
    plan = db.get(Plan, "pro")
    lic = svc.issue_license(user=user, plan=plan)

    svc.activate(key=lic._plaintext_key, machine_id_hash="m1")
    svc.activate(key=lic._plaintext_key, machine_id_hash="m1")
    assert lic.active_device_count() == 1


def test_deactivate_frees_slot(db: Session):
    user = _make_user(db, "free@example.com")
    svc = LicenseService(db)
    plan = db.get(Plan, "pro")
    lic = svc.issue_license(user=user, plan=plan)
    svc.activate(key=lic._plaintext_key, machine_id_hash="m1")
    svc.activate(key=lic._plaintext_key, machine_id_hash="m2")

    svc.deactivate_device(license=lic, machine_id_hash="m1")
    assert lic.active_device_count() == 1
    # a new device can now activate
    svc.activate(key=lic._plaintext_key, machine_id_hash="m3")
    assert lic.active_device_count() == 2


def test_revoke_marks_refunded(db: Session):
    user = _make_user(db, "refund@example.com")
    svc = LicenseService(db)
    plan = db.get(Plan, "pro")
    lic = svc.issue_license(user=user, plan=plan)
    svc.revoke(license=lic, reason="refund")
    assert lic.status == "refunded"
    assert lic.revoked_at is not None
    # activation with a revoked license fails
    with pytest.raises(AppError):
        svc.activate(key=lic._plaintext_key, machine_id_hash="m1")
