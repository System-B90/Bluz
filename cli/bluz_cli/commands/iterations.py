"""
Name: iterations.py
Purpose: Manage course iterations ("Luz" runs) — list, inspect, register, patch,
         set-current. Mirrors ui/src/api-client/iterations.ts.
Created: 2026-06-27
Author: Michael K. Steinberg
"""

from __future__ import annotations

import typer

from bluz_cli.commands._common import LIMIT_OPTION, OFFSET_OPTION, merge_fields, show
from bluz_cli.context import state
from bluz_cli.output import success

app = typer.Typer(help="Course iterations (bi-annual runs).", no_args_is_help=True)

_BASE = "/api/iterations"


@app.command("list")
def list_iterations(
    limit: int = LIMIT_OPTION,
    offset: int = OFFSET_OPTION,
) -> None:
    """List all registered iterations."""
    with state.client() as client:
        show(client.get(_BASE), title="Iterations", limit=limit, offset=offset)


@app.command()
def current() -> None:
    """Show the current (active, writable) iteration."""
    with state.client() as client:
        show(client.get(f"{_BASE}/current"), title="Current iteration")


@app.command()
def get(
    iteration_id: str = typer.Argument(..., help="Iteration id, e.g. 2026a."),
) -> None:
    """Fetch a single iteration by id."""
    with state.client() as client:
        show(client.get(f"{_BASE}/{iteration_id}"))


@app.command()
def register(
    iteration_id: str = typer.Argument(..., help="Stable id, e.g. 2026a."),
    label: str = typer.Option(
        ..., "--label", help='Human label, e.g. "מחזור 2026 א\'".'
    ),
    db_name: str = typer.Option(
        None, "--db-name", help="Mongo DB name (derived from id if omitted)."
    ),
    hive_url: str = typer.Option(
        None, "--hive-url", help="Per-iteration Hive base URL."
    ),
    start_date: str = typer.Option(None, "--start-date", help="ISO start date."),
    end_date: str = typer.Option(None, "--end-date", help="ISO end date."),
    gantt_curriculum_id: str = typer.Option(
        None, "--gantt-curriculum-id", help="Linked Postgres curriculum id."
    ),
) -> None:
    """Register a new iteration."""
    payload = merge_fields(
        ("id", iteration_id),
        ("label", label),
        ("dbName", db_name),
        ("hiveUrl", hive_url),
        ("startDate", start_date),
        ("endDate", end_date),
        ("ganttCurriculumId", gantt_curriculum_id),
    )
    with state.client() as client:
        result = client.post(_BASE, json=payload)
    success(f"Registered iteration {iteration_id}")
    show(result)


@app.command()
def patch(
    iteration_id: str = typer.Argument(..., help="Iteration id to update."),
    label: str = typer.Option(None, "--label", help="New label."),
    hive_url: str = typer.Option(None, "--hive-url", help="New Hive URL."),
    end_date: str = typer.Option(None, "--end-date", help="New ISO end date."),
    gantt_curriculum_id: str = typer.Option(
        None, "--gantt-curriculum-id", help="Linked curriculum id."
    ),
    set_current: bool = typer.Option(
        None, "--current/--not-current", help="Mark this iteration current."
    ),
) -> None:
    """Patch mutable fields of an iteration."""
    payload = merge_fields(
        ("label", label),
        ("hiveUrl", hive_url),
        ("endDate", end_date),
        ("ganttCurriculumId", gantt_curriculum_id),
        ("isCurrent", set_current),
    )
    if not payload:
        raise typer.BadParameter("Nothing to update — pass at least one field.")
    with state.client() as client:
        result = client.patch(f"{_BASE}/{iteration_id}", json=payload)
    success(f"Updated iteration {iteration_id}")
    show(result)


@app.command("set-current")
def set_current(
    iteration_id: str = typer.Argument(..., help="Iteration id to activate."),
) -> None:
    """Make an iteration the current (writable) one."""
    with state.client() as client:
        result = client.patch(f"{_BASE}/{iteration_id}", json={"isCurrent": True})
    success(f"{iteration_id} is now the current iteration")
    show(result)


@app.command()
def delete(
    iteration_id: str = typer.Argument(..., help="Iteration id to delete."),
    yes: bool = typer.Option(False, "--yes", "-y", help="Skip confirmation."),
) -> None:
    """Delete an iteration."""
    if not yes:
        typer.confirm(f"Delete iteration {iteration_id}?", abort=True)
    with state.client() as client:
        client.delete(f"{_BASE}/{iteration_id}")
    success(f"Deleted iteration {iteration_id}")
