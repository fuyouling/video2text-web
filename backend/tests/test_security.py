"""Tests for crypto / security primitives."""
from __future__ import annotations

import base64
import hashlib
import hmac

from app.core import security


def test_license_key_format():
    key = security.generate_license_key()
    assert key.startswith("V2T-PRO-")
    body = key.replace("V2T-PRO-", "")
    groups = body.split("-")
    assert len(groups) == 3
    flat = "".join(groups)
    assert len(flat) == 12
    assert all(c not in flat for c in "0O1I")


def test_license_key_hash_is_deterministic_and_one_way():
    key = "V2T-PRO-ABCD-EFGH-JKLM"
    h1 = security.hash_license_key(key)
    h2 = security.hash_license_key(key.lower())
    assert h1 == h2  # normalized before hashing
    assert len(h1) == 64
    assert h1 == hashlib.sha256(key.upper().encode()).hexdigest()


def test_jwt_roundtrip():
    token = security.create_access_token(sub="42", extra={"role": "user"})
    payload = security.decode_access_token(token)
    assert payload["sub"] == "42"
    assert payload["role"] == "user"


def test_license_token_sign_and_verify():
    payload = {"license_id": "7", "plan": "pro", "machine_id": "abc"}
    token = security.sign_license_payload(payload)
    assert "." in token
    decoded = security.verify_license_token(token)
    assert decoded["license_id"] == "7"
    assert decoded["plan"] == "pro"


def test_license_token_rejects_tamper():
    payload = {"license_id": "7"}
    token = security.sign_license_payload(payload)
    bad = token[:-4] + ("AAAA" if not token.endswith("AAAA") else "BBBB")
    try:
        security.verify_license_token(bad)
        assert False, "expected InvalidLicense"
    except security.InvalidLicense:
        pass


def _sign_paddle(body: bytes, secret: str, ts: str) -> str:
    signed = f"{ts}:{body.decode('utf-8')}".encode("utf-8")
    h1 = hmac.new(secret.encode(), signed, hashlib.sha256).hexdigest()
    return f"ts={ts};h1={h1}"


def test_paddle_signature_valid_and_invalid():
    secret = "test-webhook-secret"
    body = b'{"event_id":"evt_1"}'
    good = _sign_paddle(body, secret, "1700000000")
    assert security.verify_paddle_signature(body, good, secret) is True
    assert security.verify_paddle_signature(body, good, "wrong") is False
    assert security.verify_paddle_signature(body, None, secret) is False
    bad = good[:-1] + ("a" if not good.endswith("a") else "b")
    assert security.verify_paddle_signature(body, bad, secret) is False
