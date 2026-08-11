"""License activation and periodic verification."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api._deps import get_client_ip, rate_limit
from app.core.db import get_db
from app.schemas import (
    LicenseActivateRequest,
    LicenseActivateResponse,
    LicenseVerifyRequest,
    LicenseVerifyResponse,
)
from app.services.license_service import LicenseService

router = APIRouter(tags=["license"])


@router.post("/license/activate", response_model=LicenseActivateResponse)
def activate(
    body: LicenseActivateRequest,
    db: Session = Depends(get_db),
    _ip: str = Depends(get_client_ip),
    _rl: None = Depends(rate_limit),
) -> LicenseActivateResponse:
    svc = LicenseService(db)
    return svc.activate(key=body.key, machine_id_hash=body.machine_id_hash)


@router.post("/license/verify", response_model=LicenseVerifyResponse)
def verify(
    body: LicenseVerifyRequest,
    db: Session = Depends(get_db),
) -> LicenseVerifyResponse:
    svc = LicenseService(db)
    return svc.verify(license_id=body.license_id, machine_id_hash=body.machine_id_hash)
