"""
Name: hive.py
Purpose: Read-only proxies onto the Hive LMS reference data Bluz exposes at
         /api/hive/* (users, students, classes, subjects, modules, lessons, rooms).
         Mirrors ui/src/api-client/hive.tsx.
Created: 2026-07-30
Author: Michael K. Steinberg
"""

from __future__ import annotations

from pathlib import Path

import typer

from bluz_cli.commands._common import LIMIT_OPTION, OFFSET_OPTION, show, write_file
from bluz_cli.context import state
from bluz_cli.output import abort, success

app = typer.Typer(help="Hive LMS reference data (read-only).", no_args_is_help=True)

_BASE = "/api/hive"

# Endpoints that take no parameters at all — one command each, generated so a new
# Hive proxy route is a one-line addition.
_SIMPLE = (
    ("users", "Hive users (staff)."),
    ("students", "Hive students."),
    ("classes", "Hive classes."),
    ("subjects", "Hive subjects."),
    ("modules", "Hive modules."),
    ("rooms", "Hive rooms."),
)


def _register(name: str, help_text: str) -> None:
    @app.command(name, help=help_text)
    def _list(limit: int = LIMIT_OPTION, offset: int = OFFSET_OPTION) -> None:
        with state.client() as client:
            show(
                client.get(f"{_BASE}/{name}"),
                title=help_text.rstrip("."),
                limit=limit,
                offset=offset,
            )


for _name, _help in _SIMPLE:
    _register(_name, _help)


@app.command("lessons")
def lessons(
    module_id: str = typer.Option(
        None, "--module-id", help="Filter by Hive module id."
    ),
    program_ids: str = typer.Option(
        None, "--program-ids", help="Comma-separated parent-program ids to filter by."
    ),
    limit: int = LIMIT_OPTION,
    offset: int = OFFSET_OPTION,
) -> None:
    """Hive lessons, optionally filtered by module or parent program."""
    params = {
        "module__id": module_id,
        "module__parent_subject__parent_program_id__in": program_ids,
    }
    with state.client() as client:
        show(
            client.get(f"{_BASE}/lessons", params=params),
            title="Hive lessons",
            limit=limit,
            offset=offset,
        )


@app.command("queues")
def queues(
    module_id: int = typer.Option(
        ..., "--module", "-m", help="Hive module id whose queues to list."
    ),
    limit: int = LIMIT_OPTION,
    offset: int = OFFSET_OPTION,
) -> None:
    """Queues of one Hive module — the event dialog's per-shuffle queue picker.

    Module-scoped by design: Hive rejects user queues on a lesson rule, so an
    unscoped list would offer choices that cannot be saved.
    """
    with state.client() as client:
        show(
            client.get(f"{_BASE}/queues", params={"module": module_id}),
            title="Hive queues",
            limit=limit,
            offset=offset,
        )


@app.command("activate-lessons")
def activate_lessons() -> None:
    """Run one lesson-activation pass now and report what it did.

    This is the same pass the background timer runs every 30 seconds, and it
    is idempotent — triggering it by hand can only bring queues forward to
    where they should already be. Writes, so it needs the writable (current)
    iteration.
    """
    with state.client() as client:
        result = client.post(f"{_BASE}/lesson-activation")
    success("Ran a lesson-activation pass")
    show(result, title="Activation tick")


@app.command("avatar")
def avatar(
    slug: str = typer.Argument(..., help="Hive user id whose avatar to fetch."),
    output: Path = typer.Option(..., "--output", "-o", help="Destination image file."),
) -> None:
    """Download one Hive user's avatar image through the Bluz proxy.

    Users without an uploaded avatar answer 404 — that is a miss, not a
    failure, and it is reported as one.
    """
    with state.client() as client:
        data = client.get(f"{_BASE}/users/avatars/{slug}")
    if not isinstance(data, bytes):
        abort(f"No avatar image for {slug}: {str(data)[:200]}")
    write_file(output, data, what="avatar")
    success(f"Saved avatar for {slug} → {output} ({len(data)} bytes)")
