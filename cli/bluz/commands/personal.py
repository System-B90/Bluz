"""
Name: personal.py
Purpose: Per-user personal settings (calendar filters + Google Calendar toggles).
         Mirrors ui/src/api-client/personal-settings.ts.
Created: 2026-07-30
Author: Michael K. Steinberg
"""

from __future__ import annotations

import typer

from bluz.commands._common import merge_fields, parse_json, session, show
from bluz.output import success

app = typer.Typer(help="Personal (per-user) settings.", no_args_is_help=True)


def _split(value: str | None) -> list[str] | None:
    if value is None:
        return None
    return [item for item in (part.strip() for part in value.split(",")) if item]


@app.command()
def get() -> None:
    """Read the signed-in user's personal settings."""
    with session() as bz:
        show(bz.personal.get(), title="Personal settings")


@app.command("set")
def set_settings(
    data: str = typer.Option(
        None, "--data", help="Full settings object as JSON (replaces everything)."
    ),
    groups: str = typer.Option(None, "--groups", help="Comma-separated group ids."),
    instructors: str = typer.Option(
        None, "--instructors", help="Comma-separated instructor ids."
    ),
    favorite_outsiders: str = typer.Option(
        None, "--favorite-outsiders", help="Comma-separated outsider ids."
    ),
    google_enabled: bool = typer.Option(
        None,
        "--google-enabled/--no-google-enabled",
        help="Toggle Google Calendar sync for this user.",
    ),
    google_all_events: bool = typer.Option(
        None,
        "--google-all-events/--no-google-all-events",
        help="Sync every event, not only ones the user teaches.",
    ),
) -> None:
    """Update personal settings.

    The endpoint replaces the whole document, so field flags are merged onto the
    current values; `--data` bypasses the merge and writes verbatim.
    """
    with session() as bz:
        if data is not None:
            result = bz.personal.replace(parse_json(data, what="--data"))
        else:
            overrides = merge_fields(
                ("groups", _split(groups)),
                ("instructors", _split(instructors)),
                ("favoriteOutsiders", _split(favorite_outsiders)),
                ("googleCalendarEnabled", google_enabled),
                ("googleCalendarSyncAllEvents", google_all_events),
            )
            if not overrides:
                raise typer.BadParameter(
                    "Nothing to change — pass --data or a field flag."
                )
            result = bz.personal.replace({**bz.personal.get().to_wire(), **overrides})
    success("Saved personal settings")
    show(result)
