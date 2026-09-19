"""
Name: student_view.py
Purpose: The student board (#656) — the read-only per-day projection a student
         session may call, plus the focused-time report the board sends.
         Mirrors ui/src/api-client/student-view.ts.
Created: 2026-09-18
Author: Michael K. Steinberg
"""

from __future__ import annotations

import typer

from bluz_cli.commands._common import LIMIT_OPTION, OFFSET_OPTION, show
from bluz_cli.context import state
from bluz_cli.output import success

app = typer.Typer(
    help="The student board (read-only projection).", no_args_is_help=True
)

_BASE = "/api/student-view"


@app.command("schedule")
def schedule(
    date: str = typer.Option(
        None,
        "--date",
        help="Day to show (ISO). Staff-only preview — a student session is "
        "always served its own current day.",
    ),
    iteration: str = typer.Option(
        None, "--iteration", "--it", help="Iteration id (staff preview only)."
    ),
    limit: int = LIMIT_OPTION,
    offset: int = OFFSET_OPTION,
) -> None:
    """One day of the student board — the `StudentEvent` projection, never raw events."""
    with state.client() as client:
        show(
            client.get(f"{_BASE}/schedule", params={"date": date, "it": iteration}),
            title="Student schedule",
            limit=limit,
            offset=offset,
        )


@app.command("report-engagement")
def report_engagement(
    seconds: int = typer.Argument(..., help="Focused seconds to add to today's count."),
) -> None:
    """Add focused board time to the caller's own daily counter.

    The user and the date come from the session and the server clock, so this
    can only ever add to the reporter's own number, for today; the increment
    is clamped and the daily total capped server-side.
    """
    with state.client() as client:
        client.post(f"{_BASE}/engagement", json={"seconds": seconds})
    success(f"Reported {seconds}s of engagement")
