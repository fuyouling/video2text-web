"""End-to-end API tests: health, auth, license activate/verify endpoints."""
from __future__ import annotations

from app.core.db import SessionLocal
from app.models import Plan, User
from app.services.license_service import LicenseService


def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_register_login_me(client):
    r = client.post(
        "/auth/register", json={"email": "api@test.com", "password": "supersecret"}
    )
    assert r.status_code == 201
    assert r.json()["email"] == "api@test.com"

    r = client.post(
        "/auth/login", json={"email": "api@test.com", "password": "supersecret"}
    )
    assert r.status_code == 200
    token = r.json()["access_token"]
    assert token

    me = client.get("/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    assert me.json()["email"] == "api@test.com"

    # wrong password rejected
    bad = client.post(
        "/auth/login", json={"email": "api@test.com", "password": "nope"}
    )
    assert bad.status_code == 401


def test_license_activate_and_verify_via_api(client):
    # Issue a license directly so we have a real key.
    db = SessionLocal()
    try:
        user = User(email="activate@api.test")
        db.add(user)
        db.commit()
        db.refresh(user)
        plan = db.get(Plan, "pro")
        lic = LicenseService(db).issue_license(user=user, plan=plan)
        key = lic._plaintext_key
    finally:
        db.close()

    r = client.post(
        "/license/activate",
        json={"key": key, "machine_id_hash": "machine-api-1"},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["plan"] == "pro"
    token = body["license_token"]

    # Verify by decoding the token to obtain the license id.
    from app.core import security

    payload = security.verify_license_token(token)
    lic_id = payload["license_id"]

    v = client.post(
        "/license/verify",
        json={"license_id": lic_id, "machine_id_hash": "machine-api-1"},
    )
    assert v.status_code == 200
    assert v.json()["status"] == "active"
