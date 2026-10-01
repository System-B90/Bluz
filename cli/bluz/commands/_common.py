"""
Name: _common.py
Purpose: Shared helpers for command modules — JSON parsing for free-form payloads
         and a small wrapper that renders results through the global output mode.
Created: 2026-06-27
Author: Michael K. Steinberg
"""

from __future__ import annotations

import json
import warnings
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path
from typing import Any

import typer

from bluz.context import state
from bluz.errors import ResponseShapeWarning
from bluz.models import to_wire
from bluz.output import abort, render
from bluz.sdk import Bluz


def parse_json(value: str | None, *, what: str = "value") -> Any:
    """Parse an inline JSON string from a CLI option, aborting on bad input."""
    if value is None:
        return None
    try:
        return json.loads(value)
    except json.JSONDecodeError as exc:
        raise typer.BadParameter(f"Invalid JSON for {what}: {exc}") from exc


def read_json_file(path: Path, *, what: str = "file") -> Any:
    """Read and parse a JSON file, aborting with a styled error (not a
    traceback) on missing files, unreadable files, or bad JSON."""
    try:
        text = path.read_text(encoding="utf-8")
    except OSError as exc:
        abort(f"Could not read {what} {path}: {exc}")
    try:
        return json.loads(text)
    except json.JSONDecodeError as exc:
        abort(f"Invalid JSON in {what} {path}: {exc}")


def write_file(path: Path, data: str | bytes, *, what: str = "file") -> None:
    """Write text or bytes to a file, aborting with a styled error (not a
    traceback) on write failures (missing parent dir, permissions, ...)."""
    try:
        if isinstance(data, bytes):
            path.write_bytes(data)
        else:
            path.write_text(data, encoding="utf-8")
    except OSError as exc:
        abort(f"Could not write {what} {path}: {exc}")


@contextmanager
def session() -> Iterator[Bluz]:
    """A `Bluz` SDK session over the CLI's configured client, closed on exit.

    Commands go through the SDK rather than raw paths, so the CLI and scripts
    share one implementation of every request.
    """
    # The CLI echoes whatever the server answered, so a response that does
    # not fit its model is not worth a warning here — it is shown verbatim.
    with state.client() as client, warnings.catch_warnings():
        warnings.simplefilter("ignore", ResponseShapeWarning)
        yield Bluz.from_client(client)


def show(
    data: Any,
    *,
    title: str | None = None,
    limit: int | None = None,
    offset: int | None = None,
) -> None:
    """Render API data honouring the global --json flag.

    `limit`/`offset` slice list results client-side — the underlying
    endpoints return the full collection with no server-side pagination.
    """
    data = to_wire(data)
    if isinstance(data, list) and (limit is not None or offset is not None):
        start = offset or 0
        end = start + limit if limit is not None else None
        data = data[start:end]
    render(data, as_json=state.as_json, title=title)


# Reusable --limit/--offset Typer options for list commands (client-side
# slicing — the endpoints have no server-side pagination).
LIMIT_OPTION = typer.Option(None, "--limit", help="Cap the number of rows shown.")
OFFSET_OPTION = typer.Option(
    None, "--offset", help="Skip this many rows before showing."
)

# Reusable --iteration/--it option for iteration-scoped commands. Sent as the
# `it` query param (ITERATION_QUERY_PARAM on the server); None = current.
ITERATION_OPTION = typer.Option(
    None, "--iteration", "--it", help="Iteration id to scope to (default: current)."
)


def merge_fields(*pairs: tuple[str, Any]) -> dict[str, Any]:
    """Build a payload dict from (key, value) pairs, dropping None values."""
    return {key: value for key, value in pairs if value is not None}
