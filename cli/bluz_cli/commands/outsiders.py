"""
Name: outsiders.py
Purpose: Manage outsiders (external visitors) — list, create, update, delete.
         Mirrors ui/src/api-client/outsiders.ts.
Created: 2026-06-27
Author: Michael K. Steinberg
"""

from __future__ import annotations

import uuid

import typer

from bluz_cli.commands._common import (
    LIMIT_OPTION,
    OFFSET_OPTION,
    find_by_id,
    merge_fields,
    show,
)
from bluz_cli.context import state
from bluz_cli.output import success

app = typer.Typer(help="Outsiders (external visitors).", no_args_is_help=True)

_BASE = "/api/outsiders"


@app.command("list")
def list_outsiders(
    limit: int = LIMIT_OPTION,
    offset: int = OFFSET_OPTION,
) -> None:
    """List all outsiders."""
    with state.client() as client:
        show(client.get(_BASE), title="Outsiders", limit=limit, offset=offset)


@app.command()
def get(outsider_id: str = typer.Argument(..., help="Outsider id.")) -> None:
    """Fetch a single outsider by id (filtered client-side — no per-id route)."""
    with state.client() as client:
        items = client.get(_BASE)
    show(find_by_id(items, outsider_id))


@app.command()
def create(
    name: str = typer.Option(..., "--name", help="Full name (שם מלא)."),
    phone: str = typer.Option(..., "--phone", help="Phone (טלפון)."),
    personal_number: str = typer.Option(
        None, "--personal-number", help="מספר אישי (7 digits)."
    ),
    id_number: str = typer.Option(None, "--id-number", help="ת.ז. (9 digits)."),
    release_date: str = typer.Option(None, "--release-date", help="ISO release date."),
    comment: str = typer.Option(None, "--comment", help="Free-text comment (הערה)."),
    outsider_id: str = typer.Option(
        None, "--id", help="Outsider id (generated if omitted)."
    ),
) -> None:
    """Create an outsider."""
    payload = merge_fields(
        ("id", outsider_id or f"outsider-{uuid.uuid4()}"),
        ("name", name),
        ("phone", phone),
        ("personalNumber", personal_number),
        ("idNumber", id_number),
        ("releaseDate", release_date),
        ("comment", comment),
    )
    with state.client() as client:
        result = client.put(_BASE, json=payload)
    success(f"Created outsider {payload['id']}")
    show(result)


@app.command()
def update(
    outsider_id: str = typer.Argument(..., help="Outsider id to update."),
    name: str = typer.Option(None, "--name", help="New name."),
    phone: str = typer.Option(None, "--phone", help="New phone."),
    personal_number: str = typer.Option(
        None, "--personal-number", help="New personal number."
    ),
    id_number: str = typer.Option(None, "--id-number", help="New ID number."),
    release_date: str = typer.Option(None, "--release-date", help="New release date."),
    comment: str = typer.Option(None, "--comment", help="New comment."),
) -> None:
    """Update an outsider."""
    payload = merge_fields(
        ("id", outsider_id),
        ("name", name),
        ("phone", phone),
        ("personalNumber", personal_number),
        ("idNumber", id_number),
        ("releaseDate", release_date),
        ("comment", comment),
    )
    with state.client() as client:
        result = client.post(_BASE, json=payload)
    success(f"Updated outsider {outsider_id}")
    show(result)


@app.command()
def delete(
    outsider_id: str = typer.Argument(..., help="Outsider id to delete."),
    yes: bool = typer.Option(False, "--yes", "-y", help="Skip confirmation."),
) -> None:
    """Delete an outsider."""
    if not yes:
        typer.confirm(f"Delete outsider {outsider_id}?", abort=True)
    with state.client() as client:
        client.delete(_BASE, json=outsider_id)
    success(f"Deleted outsider {outsider_id}")
