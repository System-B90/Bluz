"""
Name: _common.py
Purpose: Shared helpers for command modules — JSON parsing for free-form payloads
         and a small wrapper that renders results through the global output mode.
Created: 2026-06-27
Author: Michael K. Steinberg
"""

from __future__ import annotations

import json
from typing import Any

import typer

from bluz_cli.context import state
from bluz_cli.output import render


def parse_json(value: str | None, *, what: str = "value") -> Any:
    """Parse an inline JSON string from a CLI option, aborting on bad input."""
    if value is None:
        return None
    try:
        return json.loads(value)
    except json.JSONDecodeError as exc:
        raise typer.BadParameter(f"Invalid JSON for {what}: {exc}") from exc


def show(data: Any, *, title: str | None = None) -> None:
    """Render API data honouring the global --json flag."""
    render(data, as_json=state.as_json, title=title)


def merge_fields(*pairs: tuple[str, Any]) -> dict[str, Any]:
    """Build a payload dict from (key, value) pairs, dropping None values."""
    return {key: value for key, value in pairs if value is not None}
