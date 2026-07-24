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
    print(json.dumps(_to_jsonable(data), ensure_ascii=False, indent=2, default=str))


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
    # If the dictionary values are all simple scalar types and we have a title (e.g. lists),
    # format it as a beautiful structured table with ID and Title columns.
    is_entity_map = title is not None and all(
        isinstance(v, (str, int, float, bool)) for v in data.values()
    )
    if is_entity_map:
        from rich import box

        table = Table(title=title, show_header=True, box=box.SIMPLE)
        table.add_column("ID", style="bold cyan")
        table.add_column("Title / Name")
        for key, value in data.items():
            table.add_row(str(key), _cell(value))
    else:
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
        try:
            decoded = data.decode("utf-8")
            console.print(decoded)
        except UnicodeDecodeError:
            import sys

            if sys.stdout.isatty():
                console.print(f"[dim]{len(data)} bytes (binary data)[/dim]")
            else:
                if hasattr(sys.stdout, "buffer"):
                    sys.stdout.buffer.write(data)
                    sys.stdout.buffer.flush()
                else:
                    console.print(data)
    else:
        console.print(_cell(data))


def _is_quiet() -> bool:
    from bluz_cli.context import state

    return state.quiet


def success(message: str) -> None:
    if _is_quiet():
        return
    console.print(f"[green]✓[/green] {message}")


def warn(message: str) -> None:
    if _is_quiet():
        return
    err_console.print(f"[yellow]![/yellow] {message}")


def fail(message: str) -> None:
    err_console.print(f"[red]✗[/red] {message}")


def abort(message: str) -> None:
    fail(message)
    raise typer.Exit(code=1)
