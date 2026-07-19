"""
Name: courses.py
Purpose: Manage courses — list, create, update, delete. Mirrors
         ui/src/api-client/courses.ts.
Created: 2026-06-27
Author: Michael K. Steinberg
"""

from __future__ import annotations

import uuid

import typer

from bluz_cli.commands._common import (
    LIMIT_OPTION,
    OFFSET_OPTION,
    find_by_id,
    merge_fields,
    parse_json,
    show,
)
from bluz_cli.context import state
from bluz_cli.output import success

app = typer.Typer(help="Courses.", no_args_is_help=True)

_BASE = "/api/course"


@app.command("list")
def list_courses(
    limit: int = LIMIT_OPTION,
    offset: int = OFFSET_OPTION,
) -> None:
    """List all courses."""
    with state.client() as client:
        show(client.get(_BASE), title="Courses", limit=limit, offset=offset)


@app.command()
def get(course_id: str = typer.Argument(..., help="Course id.")) -> None:
    """Fetch a single course by id (filtered client-side — no per-id route)."""
    with state.client() as client:
        items = client.get(_BASE)
    show(find_by_id(items, course_id))


@app.command()
def create(
    name: str = typer.Option(..., "--name", help="Course name."),
    color: str = typer.Option(None, "--color", help="Hex color, e.g. #2196f3."),
    parent_id: str = typer.Option(None, "--parent-id", help="Parent course id."),
    instructor_ids: str = typer.Option(
        None, "--instructor-ids", help="JSON array of Hive instructor ids."
    ),
    course_id: str = typer.Option(
        None, "--id", help="Course id (generated if omitted)."
    ),
) -> None:
    """Create a course."""
    payload = merge_fields(
        ("id", course_id or str(uuid.uuid4())),
        ("name", name),
        ("color", color),
        ("parentId", parent_id),
        ("instructorIds", parse_json(instructor_ids, what="--instructor-ids")),
    )
    with state.client() as client:
        result = client.put(_BASE, json=payload)
    success(f"Created course {payload['id']}")
    show(result)


@app.command()
def update(
    course_id: str = typer.Argument(..., help="Course id to update."),
    name: str = typer.Option(None, "--name", help="New name."),
    color: str = typer.Option(None, "--color", help="New hex color."),
    parent_id: str = typer.Option(None, "--parent-id", help="New parent id."),
    instructor_ids: str = typer.Option(
        None, "--instructor-ids", help="JSON array of instructor ids."
    ),
) -> None:
    """Update a course."""
    payload = merge_fields(
        ("id", course_id),
        ("name", name),
        ("color", color),
        ("parentId", parent_id),
        ("instructorIds", parse_json(instructor_ids, what="--instructor-ids")),
    )
    with state.client() as client:
        result = client.post(_BASE, json=payload)
    success(f"Updated course {course_id}")
    show(result)


@app.command()
def delete(
    course_id: str = typer.Argument(..., help="Course id to delete."),
    yes: bool = typer.Option(False, "--yes", "-y", help="Skip confirmation."),
) -> None:
    """Delete a course."""
    if not yes:
        typer.confirm(f"Delete course {course_id}?", abort=True)
    with state.client() as client:
        client.delete(_BASE, json=course_id)
    success(f"Deleted course {course_id}")
