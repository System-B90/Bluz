"""
Name: hive.py
Purpose: Read-only proxies onto the Hive LMS reference data Bluz exposes at
         /api/hive/* (users, students, classes, subjects, modules, lessons, rooms).
         Mirrors ui/src/api-client/hive.tsx.
Created: 2026-07-30
Author: Michael K. Steinberg
"""

from __future__ import annotations

import typer

from bluz_cli.commands._common import LIMIT_OPTION, OFFSET_OPTION, show
from bluz_cli.context import state

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
