"""Unified error model.

All API errors are returned as ``{"error": {"code": str, "message": str}}``.
Raise :class:`AppError` from anywhere; the registered handler in ``main.py``
converts it to the correct HTTP status.
"""
from __future__ import annotations

from fastapi import HTTPException, status


class AppError(Exception):
    """Application error with an HTTP status, stable code and message."""

    status_code: int = status.HTTP_400_BAD_REQUEST
    code: str = "invalid_request"

    def __init__(self, message: str, *, code: str | None = None, status_code: int | None = None):
        super().__init__(message)
        self.message = message
        if code is not None:
            self.code = code
        if status_code is not None:
            self.status_code = status_code

    def as_http(self) -> HTTPException:
        return HTTPException(
            status_code=self.status_code,
            detail={"error": {"code": self.code, "message": self.message}},
        )


def raise_error(
    message: str, *, code: str, status_code: int
) -> None:
    """Convenience helper to raise an :class:`AppError`."""
    raise AppError(message, code=code, status_code=status_code)


def unauthorized(message: str = "Authentication required") -> None:
    raise_error(message, code="unauthorized", status_code=status.HTTP_401_UNAUTHORIZED)


def forbidden(message: str = "Forbidden") -> None:
    raise_error(message, code="forbidden", status_code=status.HTTP_403_FORBIDDEN)


def not_found(message: str = "Not found") -> None:
    raise_error(message, code="not_found", status_code=status.HTTP_404_NOT_FOUND)


def conflict(message: str) -> None:
    raise_error(message, code="conflict", status_code=status.HTTP_409_CONFLICT)


def too_many_requests(message: str = "Too many requests, please slow down") -> None:
    raise_error(message, code="rate_limited", status_code=status.HTTP_429_TOO_MANY_REQUESTS)
