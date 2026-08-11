"""License business logic.

Handles issuing, activation, periodic verification, device management and
revocation. All secret/key logic stays server-side; the desktop client only
ever receives a signed, offline-verifiable token.
"""
from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core import security
from app.core.errors import conflict, not_found
from app.models import Device, License, Plan, User
from app.schemas import LicenseActivateResponse, LicenseVerifyResponse

# How long the desktop client may stay offline before it should re-check.
RECHECK_INTERVAL_DAYS = 30


class LicenseService:
    def __init__(self, db: Session):
        self.db = db

    # ------------------------------------------------------------------ #
    def issue_license(
        self, *, user: User, plan: Plan, order: object | None = None, key: str | None = None
    ) -> License:
        """Create a License row. Generates a key if not supplied and returns it.

        Only the key hash is persisted; the plaintext key must be delivered to
        the user exactly once (via email).
        """
        key = key or security.generate_license_key()
        license = License(
            user_id=user.id,
            order_id=getattr(order, "id", None),
            key_hash=security.hash_license_key(key),
            status="active",
            max_devices=plan.max_devices,
        )
        self.db.add(license)
        self.db.commit()
        self.db.refresh(license)
        license._plaintext_key = key  # type: ignore[attr-defined]
        return license

    # ------------------------------------------------------------------ #
    def activate(self, *, key: str, machine_id_hash: str) -> LicenseActivateResponse:
        license = self._get_active_by_key(key)
        now = datetime.now(timezone.utc)

        existing = self._find_device(license.id, machine_id_hash)
        if existing is None:
            if license.active_device_count() >= license.max_devices:
                conflict(
                    f"Device limit reached ({license.max_devices}). "
                    "Deactivate a device from your account or contact support."
                )
            existing = Device(
                license_id=license.id,
                machine_id_hash=machine_id_hash,
                first_seen_at=now,
                last_active_at=now,
            )
            self.db.add(existing)
        else:
            existing.last_active_at = now
            if existing.revoked_at is not None:
                # Re-activating a previously revoked device slot.
                existing.revoked_at = None

        self.db.commit()
        self.db.refresh(existing)

        payload = self.build_payload(license, machine_id_hash)
        token = security.sign_license_payload(payload)
        return LicenseActivateResponse(
            license_token=token,
            plan=payload["plan"],
            entitlements=payload["entitlements"],
            recheck_after=payload["recheck_after"],
        )

    def verify(self, *, license_id: str, machine_id_hash: str) -> LicenseVerifyResponse:
        license = self.db.get(License, _coerce_int(license_id))
        if license is None or license.user_id is None:
            not_found("License not found")
        return LicenseVerifyResponse(
            status="active" if license.is_active() else license.status,
            recheck_after=None,
        )

    def deactivate_device(self, *, license: License, machine_id_hash: str) -> None:
        device = self._find_device(license.id, machine_id_hash)
        if device is None:
            not_found("Device not associated with this license")
        device.revoked_at = datetime.now(timezone.utc)
        self.db.commit()

    def revoke(self, *, license: License, reason: str) -> None:
        """Mark a license refunded/revoked. Irreversible except manual restore."""
        license.status = "refunded" if "refund" in reason.lower() else "revoked"
        license.revoked_at = datetime.now(timezone.utc)
        self.db.commit()

    def count_active_devices(self, license: License) -> int:
        return license.active_device_count()

    # ------------------------------------------------------------------ #
    def build_payload(self, license: License, machine_id_hash: str) -> dict:
        plan = self.db.get(Plan, _plan_id_for(license))
        entitlements = self._entitlements_for(plan)
        now = datetime.now(timezone.utc)
        return {
            "license_id": str(license.id),
            "plan": plan.id if plan else "pro",
            "machine_id": machine_id_hash,
            "issued_at": now.isoformat(),
            "expires_at": None,
            "recheck_after": (now + timedelta(days=RECHECK_INTERVAL_DAYS)).isoformat(),
            "entitlements": entitlements,
            "max_devices": license.max_devices,
        }

    # ------------------------------------------------------------------ #
    def _get_active_by_key(self, key: str) -> License:
        key_hash = security.hash_license_key(key)
        license = self.db.scalar(
            select(License).where(License.key_hash == key_hash)
        )
        if license is None:
            not_found("Invalid license key")
        if license.status != "active":
            not_found(f"License is {license.status}")
        return license

    def _find_device(self, license_id: int, machine_id_hash: str) -> Device | None:
        return self.db.scalar(
            select(Device).where(
                Device.license_id == license_id,
                Device.machine_id_hash == machine_id_hash,
            )
        )

    @staticmethod
    def _entitlements_for(plan: Plan | None) -> list[str]:
        if plan is None:
            return ["batch", "incremental_plus", "priority_support"]
        try:
            feats = json.loads(plan.features_json)
            return feats if isinstance(feats, list) else []
        except (json.JSONDecodeError, TypeError):
            return []


def _plan_id_for(license: License) -> str:
    # Licenses are issued against the single "pro" plan in this project.
    return "pro"


def _coerce_int(value: str) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return -1
