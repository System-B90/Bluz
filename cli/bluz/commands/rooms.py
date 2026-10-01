"""
Name: rooms.py
Purpose: Manage custom rooms — list, create, update, delete, and patch extended
         info. Thin Typer layer over `bluz.api.directory.RoomsAPI`.
Created: 2026-06-27
Author: Michael K. Steinberg
"""

from __future__ import annotations

import uuid

import typer

from bluz.commands._common import (
    LIMIT_OPTION,
    OFFSET_OPTION,
    parse_json,
    session,
    show,
)
from bluz.models import RoomSource
from bluz.output import success

app = typer.Typer(help="Rooms (custom + Hive).", no_args_is_help=True)


@app.command("list")
def list_rooms(
    limit: int = LIMIT_OPTION,
    offset: int = OFFSET_OPTION,
) -> None:
    """List all rooms (custom and Hive-backed)."""
    with session() as bz:
        show(bz.rooms.list(), title="Rooms", limit=limit, offset=offset)


@app.command()
def get(room_id: str = typer.Argument(..., help="Room id.")) -> None:
    """Fetch a single room by id (filtered client-side — no per-id route)."""
    with session() as bz:
        show(bz.rooms.get(room_id))


@app.command()
def create(
    name: str = typer.Option(..., "--name", help="Room display name."),
    description: str = typer.Option(
        None, "--description", help="Optional description."
    ),
    room_id: str = typer.Option(
        None, "--id", help="Custom room id (a UUID is generated if omitted)."
    ),
) -> None:
    """Create a custom room."""
    room_id = room_id or str(uuid.uuid4())
    with session() as bz:
        result = bz.rooms.create(name, description=description, room_id=room_id)
    success(f"Created room {room_id}")
    show(result)


@app.command()
def update(
    room_id: str = typer.Argument(..., help="Custom room id to update."),
    name: str = typer.Option(None, "--name", help="New name."),
    description: str = typer.Option(None, "--description", help="New description."),
) -> None:
    """Update a custom room."""
    with session() as bz:
        result = bz.rooms.update(room_id, name=name, description=description)
    success(f"Updated room {room_id}")
    show(result)


@app.command()
def delete(
    room_id: str = typer.Argument(..., help="Custom room id to delete."),
    yes: bool = typer.Option(False, "--yes", "-y", help="Skip confirmation."),
) -> None:
    """Delete a custom room."""
    if not yes:
        typer.confirm(f"Delete room {room_id}?", abort=True)
    with session() as bz:
        bz.rooms.delete(room_id)
    success(f"Deleted room {room_id}")


@app.command("set-info")
def set_extended_info(
    room_id: str = typer.Argument(..., help="Room id."),
    source: int = typer.Option(
        int(RoomSource.HIVE), "--source", help="0=custom, 1=hive."
    ),
    extended_info: str = typer.Option(
        ...,
        "--info",
        help='Extended info JSON, e.g. \'{"workstationCount":20,"lectureSeatCount":40,"lectureComfortable":true,"peAyin":false}\'.',
    ),
) -> None:
    """Patch a room's extended info (seats, workstations, comfort flags)."""
    info = parse_json(extended_info, what="--info")
    with session() as bz:
        bz.rooms.set_extended_info(room_id, info, source=source)
    success(f"Updated extended info for room {room_id}")
