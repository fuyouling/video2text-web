"""Transactional email delivery (Resend by default).

In development / tests with an empty ``MAIL_API_KEY`` the service logs the
message instead of sending, so flows can be exercised without network access.
Swap ``_send`` for another provider (SES, Postmark) without touching callers.
"""
from __future__ import annotations

import logging

import httpx

from app.core.config import settings

logger = logging.getLogger("video2text.mail")


class MailService:
    def __init__(self, api_key: str | None = None, sender: str | None = None):
        self.api_key = api_key or settings.mail_api_key
        self.sender = sender or settings.mail_from
        self._endpoint = "https://api.resend.com/emails"

    def send_license_email(self, *, email: str, key: str, payload: dict) -> None:
        subject = "Your video2text Pro license key"
        html = self._license_html(key=key, payload=payload)
        self._send(to=email, subject=subject, html=html)

    def send_refund_notice(self, *, email: str, order_id: str) -> None:
        subject = "Your video2text refund has been processed"
        html = (
            f"<p>Hi,</p>"
            f"<p>Your refund for order <code>{order_id}</code> has been processed. "
            f"Your Pro license is now deactivated.</p>"
            f"<p>Thank you for trying video2text.</p>"
        )
        self._send(to=email, subject=subject, html=html)

    def send_receipt(self, *, email: str, order) -> None:
        subject = "Payment receipt — video2text Pro"
        amount = f"{order.amount_cents / 100:.2f} {order.currency}"
        html = (
            f"<p>Hi,</p>"
            f"<p>We received your payment of <strong>{amount}</strong> "
            f"for video2text Pro. Your license key has been emailed separately.</p>"
        )
        self._send(to=email, subject=subject, html=html)

    # ------------------------------------------------------------------ #
    def _send(self, *, to: str, subject: str, html: str) -> None:
        if not self.api_key:
            logger.warning(
                "MAIL_API_KEY not set — skipping send | to=%s subject=%s", to, subject
            )
            return
        try:
            resp = httpx.post(
                self._endpoint,
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "from": self.sender,
                    "to": [to],
                    "subject": subject,
                    "html": html,
                },
                timeout=10.0,
            )
            resp.raise_for_status()
        except Exception as exc:  # network/provider errors must not break checkout
            logger.error("Failed to send email to %s: %s", to, exc)

    @staticmethod
    def _license_html(*, key: str, payload: dict) -> str:
        return (
            f"<p>Hi,</p>"
            f"<p>Thank you for purchasing <strong>video2text Pro</strong>. "
            f"Your one-time license key is:</p>"
            f"<p style='font-size:1.25rem;font-weight:bold;letter-spacing:1px'>"
            f"{key}</p>"
            f"<p>Activate it in the desktop app under "
            f"<em>Settings → Activate Pro</em>. The license is valid on up to "
            f"{payload.get('max_devices', 2)} devices.</p>"
            f"<p>This is an automated message — replies are not monitored.</p>"
        )
