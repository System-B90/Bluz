"""
Name: colors.py
Purpose: Custom event colours — list, create, update, delete. Thin Typer layer
         over `bluz.api.directory.ColorsAPI`.
Created: 2026-06-27
Author: Michael K. Steinberg
"""

from __future__ import annotations

import typer

from bluz.commands._common import LIMIT_OPTION, OFFSET_OPTION, session, show
from bluz.output import success

app = typer.Typer(help="Custom event colours.", no_args_is_help=True)


@app.command("list")
def list_colors(limit: int = LIMIT_OPTION, offset: int = OFFSET_OPTION) -> None:
    """List every custom colour."""
    with session() as bz:
        show(bz.colors.list(), title="Custom colours", limit=limit, offset=offset)


@app.command()
def get(color_id: str = typer.Argument(..., help="Colour id.")) -> None:
    """Fetch one colour (filtered client-side — the server has no per-id route)."""
    with session() as bz:
        show(bz.colors.get(color_id))


@app.command()
def create(
    name: str = typer.Option(..., "--name", help="Display name."),
    hex_value: str = typer.Option(..., "--hex", help="Hex code, e.g. #3f51b5."),
    color_id: str = typer.Option(
        None, "--id", help="Colour id (generated when omitted)."
    ),
) -> None:
    """Create a custom colour. Ids are client-generated — one is minted if omitted."""
    with session() as bz:
        result = bz.colors.create(name, hex_value, color_id=color_id)
    success(f"Created colour {name!r}")
    show(result)


@app.command()
def update(
    color_id: str = typer.Argument(..., help="Colour id."),
    name: str = typer.Option(None, "--name", help="New display name."),
    hex_value: str = typer.Option(None, "--hex", help="New hex code."),
) -> None:
    """Update a colour. The server replaces the whole record, so unset fields are
    carried over from the current value."""
    with session() as bz:
        result = bz.colors.update(color_id, name=name, hex=hex_value)
    success(f"Updated colour {color_id}")
    show(result)


@app.command()
def delete(
    color_id: str = typer.Argument(..., help="Colour id."),
    yes: bool = typer.Option(False, "--yes", "-y", help="Skip confirmation."),
) -> None:
    """Delete a custom colour."""
    if not yes:
        typer.confirm(f"Delete colour {color_id}?", abort=True)
    with session() as bz:
        bz.colors.delete(color_id)
    success(f"Deleted colour {color_id}")
