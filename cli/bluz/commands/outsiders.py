"""
Name: outsiders.py
Purpose: Manage outsiders (external visitors) — list, create, update, delete.
         Thin Typer layer over `bluz.api.directory.OutsidersAPI`.
Created: 2026-06-27
Author: Michael K. Steinberg
"""

from __future__ import annotations

import uuid

import typer

from bluz.commands._common import LIMIT_OPTION, OFFSET_OPTION, session, show
from bluz.output import success

app = typer.Typer(help="Outsiders (external visitors).", no_args_is_help=True)


@app.command("list")
def list_outsiders(
    limit: int = LIMIT_OPTION,
    offset: int = OFFSET_OPTION,
) -> None:
    """List all outsiders."""
    with session() as bz:
        show(bz.outsiders.list(), title="Outsiders", limit=limit, offset=offset)


@app.command()
def get(outsider_id: str = typer.Argument(..., help="Outsider id.")) -> None:
    """Fetch a single outsider by id (filtered client-side — no per-id route)."""
    with session() as bz:
        show(bz.outsiders.get(outsider_id))


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
    outsider_id = outsider_id or f"outsider-{uuid.uuid4()}"
    with session() as bz:
        result = bz.outsiders.create(
            name,
            phone,
            personal_number=personal_number,
            id_number=id_number,
            release_date=release_date,
            comment=comment,
            outsider_id=outsider_id,
        )
    success(f"Created outsider {outsider_id}")
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
    with session() as bz:
        result = bz.outsiders.update(
            outsider_id,
            name=name,
            phone=phone,
            personal_number=personal_number,
            id_number=id_number,
            release_date=release_date,
            comment=comment,
        )
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
    with session() as bz:
        bz.outsiders.delete(outsider_id)
    success(f"Deleted outsider {outsider_id}")
