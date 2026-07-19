"""
Name: rooms.py
Purpose: Manage custom rooms — list, create, update, delete, and patch extended
         info. Mirrors ui/src/api-client/rooms.ts.
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
    parse_json,
    show,
)
from bluz_cli.context import state
from bluz_cli.output import success

app = typer.Typer(help="Rooms (custom + Hive).", no_args_is_help=True)

_BASE = "/api/rooms"

# RoomSource enum (ui/src/api-shared/types/room.ts): Custom = 0, Hive = 1.
ROOM_SOURCE_CUSTOM = 0
ROOM_SOURCE_HIVE = 1


@app.command("list")
def list_rooms(
    limit: int = LIMIT_OPTION,
    offset: int = OFFSET_OPTION,
) -> None:
    """List all rooms (custom and Hive-backed)."""
    with state.client() as client:
        show(client.get(_BASE), title="Rooms", limit=limit, offset=offset)


@app.command()
def get(room_id: str = typer.Argument(..., help="Room id.")) -> None:
    """Fetch a single room by id (filtered client-side — no per-id route)."""
    with state.client() as client:
        items = client.get(_BASE)
    show(find_by_id(items, room_id))


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
    payload = {
        "id": room_id or str(uuid.uuid4()),
        "name": name,
        "source": ROOM_SOURCE_CUSTOM,
    }
    if description is not None:
        payload["description"] = description
    with state.client() as client:
        result = client.put(_BASE, json=payload)
    success(f"Created room {payload['id']}")
    show(result)


@app.command()
def update(
    room_id: str = typer.Argument(..., help="Custom room id to update."),
    name: str = typer.Option(None, "--name", help="New name."),
    description: str = typer.Option(None, "--description", help="New description."),
) -> None:
    """Update a custom room."""
    payload = merge_fields(
        ("id", room_id),
        ("name", name),
        ("description", description),
        ("source", ROOM_SOURCE_CUSTOM),
    )
    with state.client() as client:
        result = client.post(_BASE, json=payload)
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
    with state.client() as client:
        client.delete(_BASE, json=room_id)
    success(f"Deleted room {room_id}")


@app.command("set-info")
def set_extended_info(
    room_id: str = typer.Argument(..., help="Room id."),
    source: int = typer.Option(ROOM_SOURCE_HIVE, "--source", help="0=custom, 1=hive."),
    extended_info: str = typer.Option(
        ...,
        "--info",
        help='Extended info JSON, e.g. \'{"workstationCount":20,"lectureSeatCount":40,"lectureComfortable":true,"peAyin":false}\'.',
    ),
) -> None:
    """Patch a room's extended info (seats, workstations, comfort flags)."""
    payload = {
        "roomId": room_id,
        "roomSource": source,
        "extendedInfo": parse_json(extended_info, what="--info"),
    }
    with state.client() as client:
        client.patch(_BASE, json=payload)
    success(f"Updated extended info for room {room_id}")
