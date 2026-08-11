"""Security primitives: password hashing, JWT, license signing, webhook verify.

All secret material (JWT secret, Ed25519 private key, Paddle webhook secret)
is read from configuration and never stored or logged.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import secrets
import string
from datetime import datetime, timedelta, timezone

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from cryptography.hazmat.primitives.asymmetric.ed25519 import (
    Ed25519PrivateKey,
    Ed25519PublicKey,
)
from cryptography.exceptions import InvalidSignature

from app.core.config import settings

# License key look: V2T-PRO-XXXX-XXXX-XXXX (16 chars, no 0/O/1/I).
_LICENSE_ALPHABET = string.ascii_uppercase + string.digits
_LICENSE_EXCLUDE = set("0O1I")
_LICENSE_CHARS = "".join(c for c in _LICENSE_ALPHABET if c not in _LICENSE_EXCLUDE)
_PH = PasswordHasher()


# --------------------------------------------------------------------------- #
# Password hashing (argon2id)
# --------------------------------------------------------------------------- #
def hash_password(plain: str) -> str:
    return _PH.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return _PH.verify(hashed, plain)
    except VerifyMismatchError:
        return False
    except Exception:
        return False


# --------------------------------------------------------------------------- #
# License key generation / hashing
# --------------------------------------------------------------------------- #
def generate_license_key() -> str:
    """Generate ``V2T-PRO-XXXX-XXXX-XXXX`` using a CSPRNG."""
    body = "".join(secrets.choice(_LICENSE_CHARS) for _ in range(12))
    groups = [body[i : i + 4] for i in range(0, 12, 4)]
    return f"V2T-PRO-{'-'.join(groups)}"


def hash_license_key(key: str) -> str:
    """Return a stable SHA-256 hash of the license key for storage."""
    return hashlib.sha256(key.strip().upper().encode("utf-8")).hexdigest()


# --------------------------------------------------------------------------- #
# JWT (user sessions)
# --------------------------------------------------------------------------- #
def create_access_token(sub: str, extra: dict | None = None) -> str:
    now = datetime.now(timezone.utc)
    payload: dict = {
        "sub": sub,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=settings.access_token_ttl_minutes)).timestamp()),
    }
    if extra:
        payload.update(extra)
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> dict:
    """Decode and verify a JWT. Raises ``jwt.PyJWTError`` on failure."""
    return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])


# --------------------------------------------------------------------------- #
# Ed25519 license payload signing
# --------------------------------------------------------------------------- #
def load_private_key() -> Ed25519PrivateKey:
    raw = base64.b64decode(settings.license_private_key)
    if len(raw) != 32:
        raise ValueError("LICENSE_ED25519_PRIVATE_KEY must be 32 raw bytes (base64).")
    return Ed25519PrivateKey.from_private_bytes(raw)


def load_public_key() -> Ed25519PublicKey:
    return load_private_key().public_key()


def sign_license_payload(payload: dict) -> str:
    """Sign a payload and return ``base64(payload).base64(sig)``.

    The desktop client verifies the signature with the embedded public key.
    """
    private_key = load_private_key()
    payload_bytes = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")
    signature = private_key.sign(payload_bytes)
    return (
        base64.urlsafe_b64encode(payload_bytes).decode("ascii")
        + "."
        + base64.urlsafe_b64encode(signature).decode("ascii")
    )


def verify_license_token(token: str) -> dict:
    """Verify and return the payload of a signed license token.

    Raises ``InvalidLicense`` on any verification failure.
    """
    try:
        payload_b64, sig_b64 = token.split(".")
    except ValueError as exc:
        raise InvalidLicense("malformed license token") from exc
    try:
        payload_bytes = base64.urlsafe_b64decode(payload_b64)
        signature = base64.urlsafe_b64decode(sig_b64)
        load_public_key().verify(signature, payload_bytes)
        return json.loads(payload_bytes)
    except (InvalidSignature, ValueError, json.JSONDecodeError) as exc:
        raise InvalidLicense("license signature verification failed") from exc


class InvalidLicense(Exception):
    """Raised when a license token fails signature or structural checks."""


# --------------------------------------------------------------------------- #
# Paddle webhook signature verification
# --------------------------------------------------------------------------- #
def verify_paddle_signature(
    raw_body: bytes, signature_header: str | None, secret: str
) -> bool:
    """Verify a Paddle webhook signature.

    Paddle signs notifications as ``ts=<timestamp>;h1=<hex_hmac>`` where the
    HMAC-SHA256 is computed over ``<timestamp>:<raw_body>`` using the
    destination secret.
    """
    if not signature_header:
        return False
    try:
        parts = dict(
            p.split("=", 1) for p in signature_header.split(";") if "=" in p
        )
        ts = parts.get("ts")
        h1 = parts.get("h1")
        if not ts or not h1:
            return False
        signed = f"{ts}:{raw_body.decode('utf-8')}".encode("utf-8")
        computed = hmac.new(secret.encode("utf-8"), signed, hashlib.sha256).hexdigest()
        return hmac.compare_digest(computed, h1)
    except Exception:
        return False
