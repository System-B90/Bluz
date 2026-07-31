"""
Name: integrations.py
Purpose: Third-party integrations — Google Calendar status/connect/disconnect/sync.
         Mirrors ui/src/api-client/google-calendar.ts.
Created: 2026-07-30
Author: Michael K. Steinberg
"""

from __future__ import annotations

import typer

from bluz_cli.commands._common import show
from bluz_cli.context import state
from bluz_cli.output import success, warn

app = typer.Typer(help="Third-party integrations.", no_args_is_help=True)

google_app = typer.Typer(help="Google Calendar integration.", no_args_is_help=True)

_BASE = "/api/integrations/google-calendar"


@google_app.command()
def status() -> None:
    """Show whether Google Calendar is configured on the server and connected for you."""
    with state.client() as client:
        show(client.get(f"{_BASE}/status"), title="Google Calendar")


@google_app.command()
def connect(
    code: str = typer.Option(
        ...,
        "--code",
        help="Authorization code from the Google Identity Services popup.",
    ),
) -> None:
    """Exchange a Google authorization code for tokens.

    The code comes from the browser-side GIS popup; there is no terminal-only
    flow, so grab it from the web UI's "Continue with Google" step.
    """
    with state.client() as client:
        client.post(f"{_BASE}/connect", json={"code": code})
    success("Connected Google Calendar")


@google_app.command()
def disconnect(
    yes: bool = typer.Option(False, "--yes", "-y", help="Skip confirmation."),
) -> None:
    """Revoke the stored Google Calendar tokens for the signed-in user."""
    if not yes:
        typer.confirm("Disconnect Google Calendar?", abort=True)
    with state.client() as client:
        client.post(f"{_BASE}/disconnect")
    success("Disconnected Google Calendar")


@google_app.command()
def sync() -> None:
    """Run a manual two-way sync over the next 90 days."""
    with state.client() as client:
        result = client.post(f"{_BASE}/sync")
    if isinstance(result, dict) and not any(result.values()):
        warn("Sync ran but moved nothing — check `bluz integrations google status`.")
    success("Synced Google Calendar")
    show(result)


app.add_typer(google_app, name="google")
