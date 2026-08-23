"""
Name: reservations.py
Purpose: List, create, and cancel room reservations. Mirrors
         ui/src/api-client/reservations.ts.
Created: 2026-06-27
Author: Michael K. Steinberg
"""

from __future__ import annotations

import typer

from bluz_cli.commands._common import LIMIT_OPTION, OFFSET_OPTION, find_by_id, show
from bluz_cli.context import state
from bluz_cli.output import success

app = typer.Typer(help="Room reservations.", no_args_is_help=True)

_BASE = "/api/reservations"


@app.command("list")
def list_reservations(
    room_id: str = typer.Option(None, "--room-id", help="Filter by room id."),
    room_source: int = typer.Option(None, "--room-source", help="0=custom, 1=hive."),
    from_: str = typer.Option(None, "--from", help="ISO start of range."),
    to: str = typer.Option(None, "--to", help="ISO end of range."),
    iteration: str = typer.Option(
        None, "--iteration", "--it", help="Iteration id to scope to."
    ),
    limit: int = LIMIT_OPTION,
    offset: int = OFFSET_OPTION,
) -> None:
    """List reservations, optionally filtered by room and date range."""
    params = {
        "roomId": room_id,
        "roomSource": room_source,
        "from": from_,
        "to": to,
        "it": iteration,
    }
    with state.client() as client:
        show(
            client.get(_BASE, params=params),
            title="Reservations",
            limit=limit,
            offset=offset,
        )


@app.command()
def get(reservation_id: str = typer.Argument(..., help="Reservation _id.")) -> None:
    """Fetch a single reservation by id (filtered client-side — no per-id route)."""
    with state.client() as client:
        items = client.get(_BASE, params={})
    show(find_by_id(items, reservation_id, id_key="_id"))


@app.command()
def create(
    room_id: str = typer.Option(..., "--room-id", help="Room id."),
    room_source: int = typer.Option(..., "--room-source", help="0=custom, 1=hive."),
    start: str = typer.Option(..., "--start", help="ISO start datetime."),
    end: str = typer.Option(..., "--end", help="ISO end datetime."),
    reserver_type: str = typer.Option(
        ..., "--reserver-type", help="instructor | outsider."
    ),
    reserver_id: str = typer.Option(..., "--reserver-id", help="Id of the reserver."),
    note: str = typer.Option(None, "--note", help="Optional note."),
    iteration: str = typer.Option(
        None, "--iteration", "--it", help="Iteration id to write into."
    ),
) -> None:
    """Create a reservation."""
    payload = {
        "roomId": room_id,
        "roomSource": room_source,
        "start": start,
        "end": end,
        "reserverType": reserver_type,
        "reserverId": reserver_id,
    }
    if note is not None:
        payload["note"] = note
    with state.client() as client:
        result = client.put(_BASE, json=payload, params={"it": iteration})
    success("Created reservation")
    show(result)


@app.command()
def cancel(
    reservation_id: str = typer.Argument(..., help="Reservation _id to cancel."),
    yes: bool = typer.Option(False, "--yes", "-y", help="Skip confirmation."),
    iteration: str = typer.Option(
        None, "--iteration", "--it", help="Iteration id to write into."
    ),
) -> None:
    """Cancel (delete) a reservation."""
    if not yes:
        typer.confirm(f"Cancel reservation {reservation_id}?", abort=True)
    with state.client() as client:
        client.delete(_BASE, json=reservation_id, params={"it": iteration})
    success(f"Cancelled reservation {reservation_id}")
