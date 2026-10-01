"""
Name: iterations.py
Purpose: Manage course iterations ("Luz" runs) — list, inspect, register, patch,
         set-current. Thin Typer layer over `bluz.api.iterations.IterationsAPI`.
Created: 2026-06-27
Author: Michael K. Steinberg
"""

from __future__ import annotations

import typer

from bluz.commands._common import LIMIT_OPTION, OFFSET_OPTION, session, show
from bluz.output import success

app = typer.Typer(help="Course iterations (bi-annual runs).", no_args_is_help=True)


@app.command("list")
def list_iterations(
    limit: int = LIMIT_OPTION,
    offset: int = OFFSET_OPTION,
) -> None:
    """List all registered iterations."""
    with session() as bz:
        show(bz.iterations.list(), title="Iterations", limit=limit, offset=offset)


@app.command()
def current() -> None:
    """Show the current (active, writable) iteration."""
    with session() as bz:
        show(bz.iterations.current(), title="Current iteration")


@app.command()
def get(
    iteration_id: str = typer.Argument(..., help="Iteration id, e.g. 2026a."),
) -> None:
    """Fetch a single iteration by id."""
    with session() as bz:
        show(bz.iterations.get(iteration_id))


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
    with session() as bz:
        result = bz.iterations.register(
            iteration_id,
            label,
            db_name=db_name,
            hive_url=hive_url,
            start_date=start_date,
            end_date=end_date,
            gantt_curriculum_id=gantt_curriculum_id,
        )
    success(f"Registered iteration {iteration_id}")
    show(result)


@app.command()
def patch(
    iteration_id: str = typer.Argument(..., help="Iteration id to update."),
    label: str = typer.Option(None, "--label", help="New label."),
    hive_url: str = typer.Option(None, "--hive-url", help="New Hive URL."),
    start_date: str = typer.Option(None, "--start-date", help="New ISO start date."),
    end_date: str = typer.Option(None, "--end-date", help="New ISO end date."),
    gantt_curriculum_id: str = typer.Option(
        None, "--gantt-curriculum-id", help="Linked curriculum id."
    ),
    set_current: bool = typer.Option(
        None, "--current/--not-current", help="Mark this iteration current."
    ),
) -> None:
    """Patch mutable fields of an iteration."""
    fields = {
        "label": label,
        "hive_url": hive_url,
        "start_date": start_date,
        "end_date": end_date,
        "gantt_curriculum_id": gantt_curriculum_id,
        "is_current": set_current,
    }
    if all(value is None for value in fields.values()):
        raise typer.BadParameter("Nothing to update — pass at least one field.")
    with session() as bz:
        result = bz.iterations.patch(iteration_id, **fields)
    success(f"Updated iteration {iteration_id}")
    show(result)


@app.command("set-current")
def set_current(
    iteration_id: str = typer.Argument(..., help="Iteration id to activate."),
) -> None:
    """Make an iteration the current (writable) one."""
    with session() as bz:
        result = bz.iterations.set_current(iteration_id)
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
    with session() as bz:
        bz.iterations.delete(iteration_id)
    success(f"Deleted iteration {iteration_id}")


@app.command("sync-hive")
def sync_hive(
    iteration_id: str = typer.Argument(..., help="Iteration id to re-snapshot."),
) -> None:
    """Re-snapshot the iteration's Hive module/subject/room names."""
    with session() as bz:
        result = bz.iterations.sync_hive(iteration_id)
    success(f"Synced iteration {iteration_id} against Hive")
    show(result)


@app.command()
def usage(
    iteration_id: str = typer.Argument(
        None, help="Iteration id. Omit to report on the current iteration."
    ),
) -> None:
    """What still hangs off an iteration — what a delete would take with it."""
    with session() as bz:
        show(
            bz.iterations.usage(iteration_id),
            title=f"Usage for iteration {iteration_id or 'current'}",
        )
