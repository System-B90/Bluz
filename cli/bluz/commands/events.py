"""
Name: events.py
Purpose: Calendar events — query by date range, fetch by ids, create/update from
         JSON, delete, compare two iterations, change history. Thin Typer
         layer over `bluz.api.calendar.EventsAPI`.
Created: 2026-06-27
Author: Michael K. Steinberg
"""

from __future__ import annotations

import typer

from bluz.commands._common import (
    LIMIT_OPTION,
    OFFSET_OPTION,
    parse_json,
    session,
    show,
)
from bluz.output import success

app = typer.Typer(help="Calendar events.", no_args_is_help=True)


@app.command("list")
def list_events(
    start_date: str = typer.Option(..., "--start", "--sd", help="ISO range start."),
    end_date: str = typer.Option(..., "--end", "--ed", help="ISO range end."),
    iteration: str = typer.Option(
        None, "--iteration", "--it", help="Iteration id to scope to."
    ),
    limit: int = LIMIT_OPTION,
    offset: int = OFFSET_OPTION,
) -> None:
    """List events in a date range (optionally for a specific iteration)."""
    with session() as bz:
        show(
            bz.events.list(start_date, end_date, iteration=iteration),
            title="Events",
            limit=limit,
            offset=offset,
        )


@app.command("get")
def get_events(
    ids: str = typer.Argument(..., help="Comma-separated event ids."),
    iteration: str = typer.Option(None, "--iteration", "--it", help="Iteration id."),
) -> None:
    """Fetch multiple events by id."""
    with session() as bz:
        show(bz.events.get(*ids.split(","), iteration=iteration))


@app.command()
def create(
    data: str = typer.Option(..., "--data", help="Event JSON payload."),
) -> None:
    """Create a calendar event from a JSON payload."""
    with session() as bz:
        result = bz.events.create(parse_json(data, what="--data"))
    success("Created event")
    show(result)


@app.command()
def update(
    data: str = typer.Option(
        ..., "--data", help="Event JSON payload (must include id)."
    ),
) -> None:
    """Update a calendar event from a JSON payload."""
    with session() as bz:
        result = bz.events.update(parse_json(data, what="--data"))
    success("Updated event")
    show(result)


@app.command()
def delete(
    event_id: str = typer.Argument(..., help="Event id to delete."),
    yes: bool = typer.Option(False, "--yes", "-y", help="Skip confirmation."),
) -> None:
    """Delete a calendar event."""
    if not yes:
        typer.confirm(f"Delete event {event_id}?", abort=True)
    with session() as bz:
        bz.events.delete(event_id)
    success(f"Deleted event {event_id}")


@app.command()
def compare(
    start_date: str = typer.Option(..., "--start", "--sd", help="ISO range start."),
    end_date: str = typer.Option(..., "--end", "--ed", help="ISO range end."),
    iteration_a: str = typer.Option(None, "--it-a", help="First iteration id."),
    iteration_b: str = typer.Option(None, "--it-b", help="Second iteration id."),
) -> None:
    """Compare events of two iterations over the same range."""
    with session() as bz:
        show(bz.events.compare(start_date, end_date, iteration_a, iteration_b))


@app.command()
def history(
    event_id: str = typer.Argument(..., help="Event id."),
    limit: int = LIMIT_OPTION,
    offset: int = OFFSET_OPTION,
) -> None:
    """Change log for one event ("היסטוריית שינויים"), newest first.

    Read-only: rows are written by the write paths themselves. The log names
    who changed what, so it is never served anonymously.
    """
    with session() as bz:
        show(
            bz.events.history(event_id),
            title=f"History for event {event_id}",
            limit=limit,
            offset=offset,
        )
