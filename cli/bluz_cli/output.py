"""
Name: output.py
Purpose: Render API results as JSON or human-friendly Rich tables, and surface
         errors consistently. Honours a global --json toggle held in Typer state.
Created: 2026-06-27
Author: Michael K. Steinberg

This module assesses output once (DRY): every command funnels through `render`
rather than re-implementing table/JSON formatting.
"""

from __future__ import annotations

import json
from typing import Any

import typer
from rich.console import Console
from rich.table import Table

console = Console()
err_console = Console(stderr=True)


def _to_jsonable(value: Any) -> Any:
    if isinstance(value, bytes):
        return value.decode("utf-8", errors="replace")
    return value


def _cell(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, (dict, list)):
        return json.dumps(value, ensure_ascii=False)
    return str(value)


def _print_json(data: Any) -> None:
    console.print_json(json.dumps(_to_jsonable(data), ensure_ascii=False, default=str))


def _render_list(data: list, title: str | None) -> None:
    if not data:
        console.print("[dim](no results)[/dim]")
        return

    if all(isinstance(row, dict) for row in data):
        columns: list[str] = []
        for row in data:
            for key in row:
                if key not in columns:
                    columns.append(key)
        table = Table(title=title, show_lines=False, header_style="bold cyan")
        for column in columns:
            table.add_column(column)
        for row in data:
            table.add_row(*[_cell(row.get(column)) for column in columns])
        console.print(table)
    else:
        for item in data:
            console.print(_cell(item))


def _render_dict(data: dict, title: str | None) -> None:
    table = Table(title=title, show_header=False, box=None)
    table.add_column("field", style="bold cyan")
    table.add_column("value")
    for key, value in data.items():
        table.add_row(str(key), _cell(value))
    console.print(table)


def render(data: Any, *, as_json: bool, title: str | None = None) -> None:
    """Print API data either as JSON or as a Rich table, depending on `as_json`."""
    if as_json:
        _print_json(data)
        return

    if isinstance(data, list):
        _render_list(data, title)
    elif isinstance(data, dict):
        _render_dict(data, title)
    elif data is None:
        console.print("[dim](empty)[/dim]")
    elif isinstance(data, bytes):
        console.print(f"[dim]{len(data)} bytes[/dim]")
    else:
        console.print(_cell(data))


def success(message: str) -> None:
    console.print(f"[green]✓[/green] {message}")


def warn(message: str) -> None:
    err_console.print(f"[yellow]![/yellow] {message}")


def fail(message: str) -> None:
    err_console.print(f"[red]✗[/red] {message}")


def abort(message: str) -> None:
    fail(message)
    raise typer.Exit(code=1)
