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

# Well-known setting keys for convenience subcommands.
PRAYER_TIMES_SETTING_KEY = "prayer-times"


@app.command()
def get(
    name: str = typer.Argument(..., help="Setting key, e.g. prayer-times."),
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
    """Read the prayer-times setting."""
    with state.client() as client:
        show(client.get(f"{_BASE}/{PRAYER_TIMES_SETTING_KEY}"), title="Prayer times")


@app.command("set-prayer")
def set_prayer(
    value: str = typer.Option(..., "--value", help="Prayer settings as JSON."),
) -> None:
    """Write the prayer-times setting."""
    with state.client() as client:
        client.post(
            f"{_BASE}/{PRAYER_TIMES_SETTING_KEY}",
            json=parse_json(value, what="--value"),
        )
    success("Saved prayer-times setting")
