"""
Name: settings.py
Purpose: Read and write keyed application settings (including prayer times).
         Mirrors ui/src/api-client/settings.ts.
Created: 2026-06-27
Author: Michael K. Steinberg
"""

from __future__ import annotations

import typer

from bluz.api.platform import (
    KNOWN_SETTING_KEYS,
    PRAYER_TIMES_SETTING_KEY,
    SCHEDULE_SETTING_KEY,
)
from bluz.commands._common import parse_json, session, show
from bluz.output import success

app = typer.Typer(help="Application settings.", no_args_is_help=True)


@app.command("list")
def list_settings() -> None:
    """List known setting keys (server has no enumeration route — this is a static list)."""
    show(KNOWN_SETTING_KEYS, title="Known setting keys")


@app.command()
def get(
    name: str = typer.Argument(..., help="Setting key, e.g. prayerTimes."),
) -> None:
    """Read a setting by key."""
    with session() as bz:
        show(bz.settings.get(name), title=name)


@app.command("set")
def set_setting(
    name: str = typer.Argument(..., help="Setting key."),
    value: str = typer.Option(..., "--value", help="Setting value as JSON."),
) -> None:
    """Write a setting value (JSON)."""
    with session() as bz:
        bz.settings.set(name, parse_json(value, what="--value"))
    success(f"Saved setting {name}")


@app.command("get-prayer")
def get_prayer() -> None:
    """Read the prayerTimes setting."""
    with session() as bz:
        show(bz.settings.get(PRAYER_TIMES_SETTING_KEY), title="Prayer times")


@app.command("set-prayer")
def set_prayer(
    value: str = typer.Option(..., "--value", help="Prayer settings as JSON."),
) -> None:
    """Write the prayerTimes setting."""
    with session() as bz:
        bz.settings.set(PRAYER_TIMES_SETTING_KEY, parse_json(value, what="--value"))
    success("Saved prayerTimes setting")


@app.command("get-schedule")
def get_schedule() -> None:
    """Read the schedule settings (day bounds, slot sizes, working days)."""
    with session() as bz:
        show(bz.settings.get(SCHEDULE_SETTING_KEY), title="Schedule settings")


@app.command("set-schedule")
def set_schedule(
    value: str = typer.Option(..., "--value", help="Schedule settings as JSON."),
) -> None:
    """Write the schedule settings."""
    with session() as bz:
        bz.settings.set(SCHEDULE_SETTING_KEY, parse_json(value, what="--value"))
    success("Saved schedule setting")
