"""
Name: errors.py
Purpose: CLI-side exception hierarchy mirroring the Bluz API error envelope.
Created: 2026-06-27
Author: Michael K. Steinberg
"""

from __future__ import annotations


class BluzCliError(Exception):
    """Base class for every error the CLI raises."""


class ConfigError(BluzCliError):
    """Raised when configuration is missing or invalid (e.g. no server URL)."""


class NotAuthenticatedError(BluzCliError):
    """Raised when the server demands a login the CLI cannot satisfy."""

    def __init__(self, message: str = "Not logged in. Run `bluz login` first.") -> None:
        super().__init__(message)


class BluzApiError(BluzCliError):
    """
    Raised when the server returns a non-zero status envelope or an HTTP error.

    Mirrors the `{ status: -1, error: { name, message, status } }` shape produced
    by `ui/src/api-server/common.tsx`.
    """

    def __init__(
        self,
        name: str,
        message: str,
        http_status: int | None = None,
    ) -> None:
        self.error_name = name
        self.error_message = message
        self.http_status = http_status
        detail = f"{name}: {message}" if message else name
        if http_status is not None:
            detail = f"{detail} (HTTP {http_status})"
        super().__init__(detail)
