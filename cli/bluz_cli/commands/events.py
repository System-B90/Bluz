"""
Name: events.py
Purpose: Calendar events — query by date range, fetch by ids, create/update from
         JSON, delete, and compare two iterations. Mirrors
         ui/src/api-client/calendar.ts.
Created: 2026-06-27
Author: Michael K. Steinberg
"""

from __future__ import annotations

import typer

from bluz_cli.commands._common import LIMIT_OPTION, OFFSET_OPTION, parse_json, show
from bluz_cli.context import state
from bluz_cli.output import success

app = typer.Typer(help="Calendar events.", no_args_is_help=True)

_BASE = "/api/event"


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
    params = {"sd": start_date, "ed": end_date, "it": iteration}
    with state.client() as client:
        show(
            client.get(_BASE, params=params),
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
    params = {"ids": ids, "it": iteration}
    with state.client() as client:
        show(client.get(_BASE, params=params))


@app.command()
def create(
    data: str = typer.Option(..., "--data", help="Event JSON payload."),
) -> None:
    """Create a calendar event from a JSON payload."""
    with state.client() as client:
        result = client.put(_BASE, json=parse_json(data, what="--data"))
    success("Created event")
    show(result)


@app.command()
def update(
    data: str = typer.Option(
        ..., "--data", help="Event JSON payload (must include id)."
    ),
) -> None:
    """Update a calendar event from a JSON payload."""
    with state.client() as client:
        result = client.post(_BASE, json=parse_json(data, what="--data"))
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
    with state.client() as client:
        client.delete(_BASE, json=event_id)
    success(f"Deleted event {event_id}")


@app.command()
def compare(
    start_date: str = typer.Option(..., "--start", "--sd", help="ISO range start."),
    end_date: str = typer.Option(..., "--end", "--ed", help="ISO range end."),
    iteration_a: str = typer.Option(None, "--it-a", help="First iteration id."),
    iteration_b: str = typer.Option(None, "--it-b", help="Second iteration id."),
) -> None:
    """Compare events of two iterations over the same range."""
    params = {"sd": start_date, "ed": end_date, "itA": iteration_a, "itB": iteration_b}
    with state.client() as client:
        show(client.get(f"{_BASE}/compare", params=params))
