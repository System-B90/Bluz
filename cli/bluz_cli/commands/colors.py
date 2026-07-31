"""
Name: colors.py
Purpose: Custom event colours — list, create, update, delete.
         Mirrors ui/src/api-client/custom-colors.ts.
Created: 2026-07-30
Author: Michael K. Steinberg
"""

from __future__ import annotations

import uuid

import typer

from bluz_cli.commands._common import LIMIT_OPTION, OFFSET_OPTION, find_by_id, show
from bluz_cli.context import state
from bluz_cli.output import success

app = typer.Typer(help="Custom event colours.", no_args_is_help=True)

_BASE = "/api/custom-colors"


@app.command("list")
def list_colors(limit: int = LIMIT_OPTION, offset: int = OFFSET_OPTION) -> None:
    """List every custom colour."""
    with state.client() as client:
        show(client.get(_BASE), title="Custom colours", limit=limit, offset=offset)


@app.command()
def get(color_id: str = typer.Argument(..., help="Colour id.")) -> None:
    """Fetch one colour (filtered client-side — the server has no per-id route)."""
    with state.client() as client:
        show(find_by_id(client.get(_BASE), color_id))


@app.command()
def create(
    name: str = typer.Option(..., "--name", help="Display name."),
    hex_value: str = typer.Option(..., "--hex", help="Hex code, e.g. #3f51b5."),
    color_id: str = typer.Option(
        None, "--id", help="Colour id (generated when omitted)."
    ),
) -> None:
    """Create a custom colour. Ids are client-generated — one is minted if omitted."""
    body = {"id": color_id or str(uuid.uuid4()), "name": name, "hex": hex_value}
    with state.client() as client:
        result = client.put(_BASE, json=body)
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
    with state.client() as client:
        current = find_by_id(client.get(_BASE), color_id)
        body = {
            "id": color_id,
            "name": name if name is not None else current.get("name"),
            "hex": hex_value if hex_value is not None else current.get("hex"),
        }
        result = client.post(_BASE, json=body)
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
    with state.client() as client:
        client.delete(_BASE, json=color_id)
    success(f"Deleted colour {color_id}")
