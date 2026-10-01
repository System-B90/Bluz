"""
Name: courses.py
Purpose: Manage courses — list, create, update, delete. Thin Typer layer over
         `bluz.api.directory.CoursesAPI`.
Created: 2026-06-27
Author: Michael K. Steinberg
"""

from __future__ import annotations

import uuid

import typer

from bluz.commands._common import (
    ITERATION_OPTION,
    LIMIT_OPTION,
    OFFSET_OPTION,
    parse_json,
    session,
    show,
)
from bluz.output import success

app = typer.Typer(help="Courses.", no_args_is_help=True)


@app.command("list")
def list_courses(
    iteration: str = ITERATION_OPTION,
    limit: int = LIMIT_OPTION,
    offset: int = OFFSET_OPTION,
) -> None:
    """List all courses."""
    with session() as bz:
        show(
            bz.courses.list(iteration=iteration),
            title="Courses",
            limit=limit,
            offset=offset,
        )


@app.command()
def get(
    course_id: str = typer.Argument(..., help="Course id."),
    iteration: str = ITERATION_OPTION,
) -> None:
    """Fetch a single course by id (filtered client-side — no per-id route)."""
    with session() as bz:
        show(bz.courses.get(course_id, iteration=iteration))


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
    iteration: str = ITERATION_OPTION,
) -> None:
    """Create a course."""
    course_id = course_id or str(uuid.uuid4())
    with session() as bz:
        result = bz.courses.create(
            name,
            color=color,
            parent=parent_id,
            instructor_ids=parse_json(instructor_ids, what="--instructor-ids"),
            course_id=course_id,
            iteration=iteration,
        )
    success(f"Created course {course_id}")
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
    iteration: str = ITERATION_OPTION,
) -> None:
    """Update a course."""
    with session() as bz:
        result = bz.courses.update(
            course_id,
            name=name,
            color=color,
            parent=parent_id,
            instructor_ids=parse_json(instructor_ids, what="--instructor-ids"),
            iteration=iteration,
        )
    success(f"Updated course {course_id}")
    show(result)


@app.command()
def delete(
    course_id: str = typer.Argument(..., help="Course id to delete."),
    iteration: str = ITERATION_OPTION,
    yes: bool = typer.Option(False, "--yes", "-y", help="Skip confirmation."),
) -> None:
    """Delete a course."""
    if not yes:
        typer.confirm(f"Delete course {course_id}?", abort=True)
    with session() as bz:
        bz.courses.delete(course_id, iteration=iteration)
    success(f"Deleted course {course_id}")
