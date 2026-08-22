"""
Name: calendar.py
Purpose: Shared calendar drafts, snapshots (+restore) and ICS export.
         Mirrors ui/src/api-client/calendar-drafts.ts and calendar-snapshots.ts.
Created: 2026-07-30
Author: Michael K. Steinberg
"""

from __future__ import annotations

from pathlib import Path

import typer

from bluz_cli.commands._common import (
    LIMIT_OPTION,
    OFFSET_OPTION,
    merge_fields,
    parse_json,
    read_json_file,
    show,
    write_file,
)
from bluz_cli.context import state
from bluz_cli.errors import BluzApiError
from bluz_cli.output import success

app = typer.Typer(
    help="Shared calendar drafts, snapshots and ICS export.", no_args_is_help=True
)

drafts_app = typer.Typer(help="Shared calendar drafts.", no_args_is_help=True)
snapshots_app = typer.Typer(help="Calendar snapshots.", no_args_is_help=True)

_DRAFTS = "/api/calendar/drafts"
_SNAPSHOTS = "/api/calendar/snapshots"

ITERATION_OPTION = typer.Option(
    None, "--iteration", "--it", help="Iteration id to scope to (default: current)."
)


def _events_from(data: str | None, file: Path | None) -> list | None:
    """
    Read an events array from --events JSON or --events-file.

    Returns None when neither flag was passed, so an update that only touches
    the label leaves the draft's events alone instead of clearing them.
    """
    if data is not None and file is not None:
        raise typer.BadParameter("Pass --events or --events-file, not both.")
    if file is not None:
        payload = read_json_file(file, what="--events-file")
    elif data is not None:
        payload = parse_json(data, what="--events")
    else:
        return None
    if not isinstance(payload, list):
        raise typer.BadParameter("Events payload must be a JSON array of events.")
    return payload


# --- drafts -----------------------------------------------------------------


@drafts_app.command("list")
def list_drafts(
    iteration: str = ITERATION_OPTION,
    limit: int = LIMIT_OPTION,
    offset: int = OFFSET_OPTION,
) -> None:
    """List shared draft summaries (newest-updated first)."""
    with state.client() as client:
        show(
            client.get(_DRAFTS, params={"it": iteration}),
            title="Calendar drafts",
            limit=limit,
            offset=offset,
        )


@drafts_app.command("get")
def get_draft(
    draft_id: str = typer.Argument(..., help="Draft id."),
    iteration: str = ITERATION_OPTION,
) -> None:
    """Fetch one draft including its events."""
    with state.client() as client:
        show(client.get(_DRAFTS, params={"id": draft_id, "it": iteration}))


@drafts_app.command("create")
def create_draft(
    label: str = typer.Option(..., "--label", help="Draft label."),
    events: str = typer.Option(None, "--events", help="Events as a JSON array."),
    events_file: Path = typer.Option(
        None, "--events-file", help="Path to a JSON file holding the events array."
    ),
    iteration: str = ITERATION_OPTION,
) -> None:
    """Create a shared draft from a set of events."""
    body = {"label": label, "events": _events_from(events, events_file) or []}
    with state.client() as client:
        result = client.post(_DRAFTS, json=body, params={"it": iteration})
    success(f"Created draft {label!r}")
    show(result)


@drafts_app.command("update")
def update_draft(
    draft_id: str = typer.Argument(..., help="Draft id."),
    label: str = typer.Option(None, "--label", help="New label (optional)."),
    events: str = typer.Option(None, "--events", help="Events as a JSON array."),
    events_file: Path = typer.Option(
        None, "--events-file", help="Path to a JSON file holding the events array."
    ),
    iteration: str = ITERATION_OPTION,
) -> None:
    """Replace a draft's events (and optionally its label)."""
    body = merge_fields(
        ("id", draft_id),
        ("label", label),
        ("events", _events_from(events, events_file)),
    )
    with state.client() as client:
        result = client.put(_DRAFTS, json=body, params={"it": iteration})
    success(f"Updated draft {draft_id}")
    show(result)


@drafts_app.command("delete")
def delete_draft(
    draft_id: str = typer.Argument(..., help="Draft id."),
    iteration: str = ITERATION_OPTION,
    yes: bool = typer.Option(False, "--yes", "-y", help="Skip confirmation."),
) -> None:
    """Delete a shared draft."""
    if not yes:
        typer.confirm(f"Delete draft {draft_id}?", abort=True)
    with state.client() as client:
        client.delete(_DRAFTS, params={"id": draft_id, "it": iteration})
    success(f"Deleted draft {draft_id}")


# --- snapshots --------------------------------------------------------------


@snapshots_app.command("list")
def list_snapshots(
    iteration: str = ITERATION_OPTION,
    limit: int = LIMIT_OPTION,
    offset: int = OFFSET_OPTION,
) -> None:
    """List snapshot summaries (newest first)."""
    with state.client() as client:
        show(
            client.get(_SNAPSHOTS, params={"it": iteration}),
            title="Calendar snapshots",
            limit=limit,
            offset=offset,
        )


@snapshots_app.command("get")
def get_snapshot(
    snapshot_id: str = typer.Argument(..., help="Snapshot id."),
    iteration: str = ITERATION_OPTION,
) -> None:
    """Fetch one snapshot including its captured events."""
    with state.client() as client:
        show(client.get(_SNAPSHOTS, params={"id": snapshot_id, "it": iteration}))


@snapshots_app.command("create")
def create_snapshot(
    label: str = typer.Option(..., "--label", help="Snapshot label."),
    events: str = typer.Option(None, "--events", help="Events as a JSON array."),
    events_file: Path = typer.Option(
        None, "--events-file", help="Path to a JSON file holding the events array."
    ),
    iteration: str = ITERATION_OPTION,
) -> None:
    """Capture a snapshot from the supplied events."""
    body = {"label": label, "events": _events_from(events, events_file) or []}
    with state.client() as client:
        result = client.post(_SNAPSHOTS, json=body, params={"it": iteration})
    success(f"Created snapshot {label!r}")
    show(result)


@snapshots_app.command("delete")
def delete_snapshot(
    snapshot_id: str = typer.Argument(..., help="Snapshot id."),
    iteration: str = ITERATION_OPTION,
    yes: bool = typer.Option(False, "--yes", "-y", help="Skip confirmation."),
) -> None:
    """Delete a snapshot."""
    if not yes:
        typer.confirm(f"Delete snapshot {snapshot_id}?", abort=True)
    with state.client() as client:
        client.delete(_SNAPSHOTS, params={"id": snapshot_id, "it": iteration})
    success(f"Deleted snapshot {snapshot_id}")


@snapshots_app.command("restore")
def restore_snapshot(
    snapshot_id: str = typer.Argument(..., help="Snapshot id."),
    iteration: str = ITERATION_OPTION,
    yes: bool = typer.Option(False, "--yes", "-y", help="Skip confirmation."),
) -> None:
    """Restore the calendar to a snapshot (archives live events in its range)."""
    if not yes:
        typer.confirm(
            f"Restore snapshot {snapshot_id}? Live events in its date range will be archived.",
            abort=True,
        )
    with state.client() as client:
        result = client.post(
            f"{_SNAPSHOTS}/restore", params={"id": snapshot_id, "it": iteration}
        )
    success(f"Restored snapshot {snapshot_id}")
    show(result)


# --- ICS export -------------------------------------------------------------


@app.command("export-ics")
def export_ics(
    start_date: str = typer.Option(..., "--start", "--sd", help="ISO range start."),
    end_date: str = typer.Option(..., "--end", "--ed", help="ISO range end."),
    output: Path = typer.Option(None, "--output", "-o", help="Destination .ics path."),
    iteration: str = ITERATION_OPTION,
) -> None:
    """Export the schedule in a date range as an ICS calendar (max 366 days)."""
    with state.client() as client:
        data = client.get(
            "/api/event/export/ics",
            params={"sd": start_date, "ed": end_date, "it": iteration},
        )
    if isinstance(data, str):
        data = data.encode("utf-8")
    if not isinstance(data, bytes):
        raise BluzApiError(
            "InvalidResponse",
            f"Expected an ICS payload, got {type(data).__name__}: {str(data)[:200]}",
        )
    if output is None:
        typer.echo(data.decode("utf-8", errors="replace"))
        return
    write_file(output, data, what="export")
    success(f"Exported schedule → {output} ({len(data)} bytes)")


app.add_typer(drafts_app, name="drafts")
app.add_typer(snapshots_app, name="snapshots")
