"""
Name: _common.py
Purpose: Shared helpers for command modules — JSON parsing for free-form payloads
         and a small wrapper that renders results through the global output mode.
Created: 2026-06-27
Author: Michael K. Steinberg
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import typer

from bluz_cli.context import state
from bluz_cli.output import abort, render


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


def merge_fields(*pairs: tuple[str, Any]) -> dict[str, Any]:
    """Build a payload dict from (key, value) pairs, dropping None values."""
    return {key: value for key, value in pairs if value is not None}


def find_by_id(
    items: list[dict[str, Any]], item_id: str, *, id_key: str = "id"
) -> dict[str, Any]:
    """
    Pick one item out of a collection by id.

    Several resources (courses, rooms, outsiders, reservations) have no
    per-id GET route on the server — only a bulk list. This filters
    client-side so `<resource> get <id>` works without a new endpoint.
    """
    for item in items:
        if str(item.get(id_key)) == str(item_id):
            return item
    abort(f"No item with {id_key}={item_id!r} found.")
    raise AssertionError("unreachable")  # abort() always raises
