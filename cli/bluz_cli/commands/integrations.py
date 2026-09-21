"""
Name: integrations.py
Purpose: Third-party integrations — Google Calendar status/connect/disconnect/sync/
         calendars/select-calendar/purge.
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


@google_app.command()
def calendars() -> None:
    """List the Google calendars you can mirror into (own + shared with write access)."""
    with state.client() as client:
        show(client.get(f"{_BASE}/calendars"), title="Google calendars")


@google_app.command("select-calendar")
def select_calendar(
    calendar_id: str | None = typer.Option(
        None,
        "--id",
        help="Calendar id from `bluz integrations google calendars` (a shared one to join colleagues on).",
    ),
    new: bool = typer.Option(
        False,
        "--new",
        help="Create a fresh Bluz calendar for the current iteration instead.",
    ),
) -> None:
    """Point your link at another calendar. Exactly one of --id / --new."""
    if bool(calendar_id) == new:
        raise typer.BadParameter("Pass exactly one of --id or --new.")
    payload: dict[str, object] = (
        {"createNew": True} if new else {"calendarId": calendar_id}
    )
    with state.client() as client:
        result = client.post(f"{_BASE}/calendars", json=payload)
    success("Switched Google calendar — run `bluz integrations google sync` to fill it")
    show(result)


@google_app.command()
def purge(
    scope: str = typer.Option(
        "orphaned",
        "--scope",
        help="`orphaned` (no live Bluz event behind them) or `all` (every Bluz-created event).",
    ),
    yes: bool = typer.Option(False, "--yes", "-y", help="Skip confirmation."),
) -> None:
    """Remove Bluz-created events from your linked Google calendar."""
    if scope not in ("orphaned", "all"):
        raise typer.BadParameter("--scope must be `orphaned` or `all`.")
    if not yes:
        typer.confirm(
            f"Delete {'ALL Bluz-created' if scope == 'all' else 'orphaned Bluz'} events from your Google calendar?",
            abort=True,
        )
    with state.client() as client:
        result = client.post(f"{_BASE}/purge", json={"scope": scope})
    if isinstance(result, dict) and result.get("failed"):
        warn(f"{result['failed']} deletes failed — Google rejected them after retries.")
    success("Purged Google Calendar")
    show(result)


app.add_typer(google_app, name="google")
