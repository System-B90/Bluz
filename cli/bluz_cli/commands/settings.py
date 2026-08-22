"""
Name: settings.py
Purpose: Read and write keyed application settings (including prayer times).
         Mirrors ui/src/api-client/settings.ts.
Created: 2026-06-27
Author: Michael K. Steinberg
"""

from __future__ import annotations

import typer

from bluz_cli.commands._common import parse_json, show
from bluz_cli.context import state
from bluz_cli.output import success

app = typer.Typer(help="Application settings.", no_args_is_help=True)

_BASE = "/api/settings"

# Well-known setting keys for convenience subcommands. Kept in step with
# api-shared/types/settings/* — the server has no enumeration route.
PRAYER_TIMES_SETTING_KEY = "prayerTimes"
SCHEDULE_SETTING_KEY = "schedule"

KNOWN_SETTING_KEYS = [PRAYER_TIMES_SETTING_KEY, SCHEDULE_SETTING_KEY]


@app.command("list")
def list_settings() -> None:
    """List known setting keys (server has no enumeration route — this is a static list)."""
    show(KNOWN_SETTING_KEYS, title="Known setting keys")


@app.command()
def get(
    name: str = typer.Argument(..., help="Setting key, e.g. prayerTimes."),
) -> None:
    """Read a setting by key."""
    with state.client() as client:
        show(client.get(f"{_BASE}/{name}"), title=name)


@app.command("set")
def set_setting(
    name: str = typer.Argument(..., help="Setting key."),
    value: str = typer.Option(..., "--value", help="Setting value as JSON."),
) -> None:
    """Write a setting value (JSON)."""
    with state.client() as client:
        client.post(f"{_BASE}/{name}", json=parse_json(value, what="--value"))
    success(f"Saved setting {name}")


@app.command("get-prayer")
def get_prayer() -> None:
    """Read the prayerTimes setting."""
    with state.client() as client:
        show(client.get(f"{_BASE}/{PRAYER_TIMES_SETTING_KEY}"), title="Prayer times")


@app.command("set-prayer")
def set_prayer(
    value: str = typer.Option(..., "--value", help="Prayer settings as JSON."),
) -> None:
    """Write the prayerTimes setting."""
    with state.client() as client:
        client.post(
            f"{_BASE}/{PRAYER_TIMES_SETTING_KEY}",
            json=parse_json(value, what="--value"),
        )
    success("Saved prayerTimes setting")


@app.command("get-schedule")
def get_schedule() -> None:
    """Read the schedule settings (day bounds, slot sizes, working days)."""
    with state.client() as client:
        show(client.get(f"{_BASE}/{SCHEDULE_SETTING_KEY}"), title="Schedule settings")


@app.command("set-schedule")
def set_schedule(
    value: str = typer.Option(..., "--value", help="Schedule settings as JSON."),
) -> None:
    """Write the schedule settings."""
    with state.client() as client:
        client.post(
            f"{_BASE}/{SCHEDULE_SETTING_KEY}", json=parse_json(value, what="--value")
        )
    success("Saved schedule setting")
