"""
Name: errors.py
Purpose: Exception hierarchy mirroring the Bluz API error envelope. Every error
         the package raises derives from `BluzError`, so one `except` covers it.
Created: 2026-06-27
Author: Michael K. Steinberg
"""

from __future__ import annotations

__all__ = [
    "BluzApiError",
    "BluzCliError",
    "BluzError",
    "ConfigError",
    "DetachedModelError",
    "NotAuthenticatedError",
    "NotFoundError",
    "ResponseShapeWarning",
]


class BluzError(Exception):
    """Base class for every error the package raises."""


# Pre-rename name, kept so `except BluzCliError` in existing scripts still works.
BluzCliError = BluzError


class ConfigError(BluzError):
    """Raised when configuration is missing or invalid (e.g. no server URL)."""


class NotAuthenticatedError(BluzError):
    """Raised when the server demands a login the client cannot satisfy."""

    def __init__(self, message: str = "Not logged in. Run `bluz login` first.") -> None:
        super().__init__(message)


class BluzApiError(BluzError):
    """
    Raised when the server returns a non-zero status envelope or an HTTP error.

    Mirrors the `{ status: -1, error: { name, message, status } }` shape produced
    by `ui/src/api-server/common.ts`.

    Attributes:
        error_name: Server-side error class, e.g. "ClientApiError".
        error_message: Human-readable message (often Hebrew).
        http_status: HTTP status code, when there was a response.
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


class NotFoundError(BluzError, LookupError):
    """Raised by client-side lookups (`rooms.get(id)`, `curriculum["title"]`) on a miss."""


class ResponseShapeWarning(UserWarning):
    """A server response did not match its model; it was kept unvalidated.

    Silence with `warnings.simplefilter("ignore", ResponseShapeWarning)`, or
    turn into an error with `"error"` to catch server/client drift in tests.
    """


class DetachedModelError(BluzError):
    """Raised when a model built by hand (not fetched) is asked to talk to the server."""

    def __init__(self, model: str) -> None:
        super().__init__(
            f"This {model} is not bound to a Bluz session. Fetch it through a "
            "`Bluz` client (e.g. `bz.rooms.list()`) or bind it with "
            f"`{model}.from_wire(data, bz)`."
        )
