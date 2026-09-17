"""
Name: gantt.py
Purpose: Drive the Gantt / curriculum API. A single entity-app factory provides
         CRUD + link + allocate-time + reorder for every Gantt entity (DRY), and
         curriculum-specific commands add export/import/constraints/mappings.
         Mirrors ui/src/api-client/gantt/*.
Created: 2026-06-27
Author: Michael K. Steinberg
"""

from __future__ import annotations

import json
from pathlib import Path

import typer

from bluz_cli.commands._common import (
    LIMIT_OPTION,
    OFFSET_OPTION,
    parse_json,
    read_json_file,
    show,
    write_file,
)
from bluz_cli.context import state
from bluz_cli.errors import BluzApiError
from bluz_cli.output import success

app = typer.Typer(help="Gantt / curriculum engine.", no_args_is_help=True)

_BASE = "/api/gantt"

# Naive de-pluralisation turns "syllabuses" into "syllabuse"; spell out the
# entity names whose singular is not just the plural minus an "s".
_SINGULAR_BY_ENTITY = {
    "curriculums": "curriculum",
    "syllabuses": "syllabus",
    "modules": "module",
    "events": "event",
    "days": "day",
    "weeks": "week",
}


def _singular(entity: str) -> str:
    """The singular entity name used in user-facing messages."""
    return _SINGULAR_BY_ENTITY.get(entity, entity.removesuffix("s") or entity)


def _entity_app(
    entity: str,
    *,
    help_text: str,
    link: bool = False,
    allocate: bool = False,
    reorder: tuple[str, str] | None = None,
) -> typer.Typer:
    """
    Build a Typer sub-app exposing the standard collection routes for a Gantt
    entity. `reorder` is an optional (subcommand_name, body_key) pair for the
    entity's reorder endpoint (e.g. syllabus → ("reorder-modules", "moduleIds")).
    """
    sub = typer.Typer(help=help_text, no_args_is_help=True)
    base = f"{_BASE}/{entity}"

    @sub.command("list")
    def list_items(
        with_parents: bool = typer.Option(
            False,
            "--with-parents",
            help="Include each item's parent id (weeks/days label by number/index).",
        ),
        limit: int = LIMIT_OPTION,
        offset: int = OFFSET_OPTION,
    ) -> None:
        """List items as an array of {id, title} (server returns an id→title map)."""
        with state.client() as client:
            items = client.get(
                base, params={"withParents": 1 if with_parents else None}
            )
        # `?withParents=1` turns the map's values from a bare title into an
        # object carrying the title plus the entity's parent key.
        rows = [
            {"id": item_id, **value}
            if isinstance(value, dict)
            else {"id": item_id, "title": value}
            for item_id, value in items.items()
        ]
        show(rows, title=entity, limit=limit, offset=offset)

    @sub.command("get")
    def get_item(item_id: str = typer.Argument(..., help="Item id.")) -> None:
        """Fetch one item (with its sub-tree)."""
        with state.client() as client:
            show(client.get(f"{base}/{item_id}"))

    @sub.command("get-many")
    def get_many(ids: str = typer.Argument(..., help="Comma-separated ids.")) -> None:
        """Fetch several items by id, as an array (server returns an id→item map)."""
        with state.client() as client:
            items = client.get(base, params={"ids": ids})
        show(list(items.values()))

    @sub.command("create")
    def create_item(
        data: str = typer.Option(..., "--data", help="JSON payload."),
    ) -> None:
        """Create an item from a JSON payload."""
        with state.client() as client:
            result = client.post(base, json=parse_json(data, what="--data"))
        success(f"Created {_singular(entity)}")
        show(result)

    @sub.command("update")
    def update_item(
        item_id: str = typer.Argument(..., help="Item id."),
        data: str = typer.Option(..., "--data", help="JSON patch payload."),
    ) -> None:
        """Patch an item from a JSON payload."""
        with state.client() as client:
            result = client.patch(
                f"{base}/{item_id}", json=parse_json(data, what="--data")
            )
        success(f"Updated {item_id}")
        show(result)

    @sub.command("delete")
    def delete_item(
        item_id: str = typer.Argument(..., help="Item id."),
        yes: bool = typer.Option(False, "--yes", "-y", help="Skip confirmation."),
    ) -> None:
        """Delete an item."""
        if not yes:
            typer.confirm(f"Delete {entity} {item_id}?", abort=True)
        with state.client() as client:
            client.delete(f"{base}/{item_id}")
        success(f"Deleted {item_id}")

    if link:

        @sub.command("link")
        def link_item(
            item_id: str = typer.Argument(..., help="Item id."),
            new_parent_id: str = typer.Argument(..., help="New parent id."),
        ) -> None:
            """Link an item under a new parent."""
            with state.client() as client:
                result = client.post(
                    f"{base}/{item_id}/link", json={"newParentId": new_parent_id}
                )
            success(f"Linked {item_id} → {new_parent_id}")
            show(result)

        @sub.command("unlink")
        def unlink_item(
            item_id: str = typer.Argument(..., help="Item id."),
            old_parent_id: str = typer.Argument(..., help="Parent id to detach from."),
        ) -> None:
            """Unlink an item from a parent."""
            with state.client() as client:
                client.delete(
                    f"{base}/{item_id}/link", json={"oldParentId": old_parent_id}
                )
            success(f"Unlinked {item_id} from {old_parent_id}")

    if allocate:

        @sub.command("get-time")
        def get_time(
            item_id: str = typer.Argument(..., help="Item id."),
            container_id: str = typer.Argument(..., help="Container (curriculum) id."),
        ) -> None:
            """Get the item's allocated time within a container."""
            with state.client() as client:
                show(
                    client.get(
                        f"{base}/{item_id}/allocate-time",
                        params={"containerId": container_id},
                    )
                )

        @sub.command("set-time")
        def set_time(
            item_id: str = typer.Argument(..., help="Item id."),
            container_id: str = typer.Argument(..., help="Container (curriculum) id."),
            duration: int = typer.Argument(..., help="Duration to allocate."),
        ) -> None:
            """Set the item's allocated time within a container."""
            with state.client() as client:
                client.post(
                    f"{base}/{item_id}/allocate-time",
                    json={"containerId": container_id, "duration": duration},
                )
            success(f"Allocated {duration} to {item_id} in {container_id}")

    if reorder is not None:
        sub_name, body_key = reorder

        @sub.command(sub_name)
        def reorder_children(
            item_id: str = typer.Argument(..., help="Parent item id."),
            ids: str = typer.Argument(
                ..., help="Comma-separated child ids in new order."
            ),
        ) -> None:
            """Reorder an item's children."""
            ordered = [piece for piece in ids.split(",") if piece]
            with state.client() as client:
                client.post(f"{base}/{item_id}/{sub_name}", json={body_key: ordered})
            success(f"Reordered children of {item_id}")

    return sub


# --- entity sub-apps --------------------------------------------------------

curriculums_app = _entity_app("curriculums", help_text="Curriculums.")
syllabuses_app = _entity_app(
    "syllabuses",
    help_text="Syllabuses.",
    link=True,
    reorder=("reorder-modules", "moduleIds"),
)
modules_app = _entity_app(
    "modules",
    help_text="Modules.",
    link=True,
    allocate=True,
    reorder=("reorder-events", "eventIds"),
)
events_app = _entity_app("events", help_text="Gantt events.", link=True, allocate=True)
days_app = _entity_app("days", help_text="Curriculum days.", link=False)
weeks_app = _entity_app("weeks", help_text="Curriculum weeks.", link=False)


# --- curriculum-specific extras ---------------------------------------------


@curriculums_app.command("export")
def export_curriculum(
    curriculum_id: str = typer.Argument(..., help="Curriculum id."),
    output: Path = typer.Option(
        None, "--output", "-o", help="Write JSON to this file."
    ),
) -> None:
    """Export a curriculum tree (curriculum + mappings + constraints)."""
    with state.client() as client:
        data = client.get(f"{_BASE}/curriculums/{curriculum_id}/export")
    if output is not None:
        write_file(
            output,
            json.dumps(data, ensure_ascii=False, indent=2),
            what="export",
        )
        success(f"Exported curriculum {curriculum_id} → {output}")
    else:
        show(data)


@curriculums_app.command("export-excel")
def export_curriculum_excel(
    curriculum_id: str = typer.Argument(..., help="Curriculum id."),
    output: Path = typer.Option(..., "--output", "-o", help="Destination .xlsx path."),
) -> None:
    """Export a curriculum as an Excel workbook."""
    with state.client() as client:
        data = client.get(f"{_BASE}/curriculums/{curriculum_id}/export/excel")
    if not isinstance(data, bytes):
        raise BluzApiError(
            "InvalidResponse",
            f"Expected an .xlsx byte stream, got {type(data).__name__}: {str(data)[:200]}",
        )
    write_file(output, data, what="export")
    success(f"Exported curriculum {curriculum_id} → {output} ({len(data)} bytes)")


@curriculums_app.command("import")
def import_curriculum(
    file: Path = typer.Argument(..., help="Path to an exported curriculum JSON file."),
) -> None:
    """Import a curriculum from an export file."""
    payload = read_json_file(file, what="curriculum file")
    with state.client() as client:
        result = client.post(f"{_BASE}/curriculums/import", json=payload)
    success("Imported curriculum")
    show(result)


@curriculums_app.command("constraints")
def list_constraints(
    curriculum_id: str = typer.Argument(..., help="Curriculum id."),
    syllabus_id: str = typer.Option(None, "--syllabus-id", help="Scope to a syllabus."),
    module_id: str = typer.Option(None, "--module-id", help="Scope to a module."),
) -> None:
    """List scheduling constraints for a curriculum."""
    params = {"syllabusId": syllabus_id, "moduleId": module_id}
    with state.client() as client:
        show(
            client.get(
                f"{_BASE}/curriculums/{curriculum_id}/constraints", params=params
            ),
            title="Constraints",
        )


@curriculums_app.command("mappings")
def list_mappings(
    curriculum_id: str = typer.Argument(..., help="Curriculum id."),
) -> None:
    """List day/module mappings for a curriculum."""
    with state.client() as client:
        show(
            client.get(f"{_BASE}/curriculums/{curriculum_id}/mappings"),
            title="Mappings",
        )


@curriculums_app.command("set-mapping")
def set_mapping(
    curriculum_id: str = typer.Argument(..., help="Curriculum id."),
    module_id: str = typer.Option(..., "--module-id", help="Module id."),
    day_id: str = typer.Option(..., "--day-id", help="Day to place the mapping on."),
    event_id: str = typer.Option(
        None, "--event-id", help="Event id (omit to place the module itself)."
    ),
    sort_order: float = typer.Option(
        None, "--sort-order", help="Sort order weight within the day."
    ),
) -> None:
    """Create a module/event day mapping (cMDA) for a curriculum."""
    payload = {"moduleId": module_id, "dayId": day_id}
    if event_id is not None:
        payload["eventId"] = event_id
    if sort_order is not None:
        payload["sortOrder"] = sort_order
    with state.client() as client:
        result = client.post(
            f"{_BASE}/curriculums/{curriculum_id}/mappings", json=payload
        )
    success(
        f"Placed {'event ' + event_id if event_id else 'module ' + module_id} on day {day_id}"
    )
    show(result)


@curriculums_app.command("move-mapping")
def move_mapping(
    curriculum_id: str = typer.Argument(..., help="Curriculum id."),
    module_id: str = typer.Option(..., "--module-id", help="Module id."),
    old_day_id: str = typer.Option(
        ..., "--old-day-id", help="Day the mapping is currently on."
    ),
    new_day_id: str = typer.Option(
        None, "--new-day-id", help="Day to move the mapping to."
    ),
    event_id: str = typer.Option(
        None, "--event-id", help="Event id (omit to move the module itself)."
    ),
    sort_order: float = typer.Option(
        None, "--sort-order", help="New sort order weight within the day."
    ),
) -> None:
    """Move or reorder an existing module/event day mapping (cMDA)."""
    new_values = {}
    if new_day_id is not None:
        new_values["dayId"] = new_day_id
    if sort_order is not None:
        new_values["sortOrder"] = sort_order
    if not new_values:
        raise typer.BadParameter("Provide --new-day-id and/or --sort-order.")
    payload = {
        "moduleId": module_id,
        "eventId": event_id,
        "oldMapping": {"dayId": old_day_id},
        "newValues": new_values,
    }
    with state.client() as client:
        result = client.patch(
            f"{_BASE}/curriculums/{curriculum_id}/mappings", json=payload
        )
    success(
        f"Moved mapping for {'event ' + event_id if event_id else 'module ' + module_id}"
    )
    show(result)


@curriculums_app.command("unset-mapping")
def unset_mapping(
    curriculum_id: str = typer.Argument(..., help="Curriculum id."),
    module_id: str = typer.Option(..., "--module-id", help="Module id."),
    day_id: str = typer.Option(
        ..., "--day-id", help="Day the mapping is currently on."
    ),
    event_id: str = typer.Option(
        None, "--event-id", help="Event id (omit to unset the module itself)."
    ),
) -> None:
    """Delete a module/event day mapping (cMDA) for a curriculum."""
    payload = {"moduleId": module_id, "eventId": event_id, "dayId": day_id}
    with state.client() as client:
        client.delete(f"{_BASE}/curriculums/{curriculum_id}/mappings", json=payload)
    success(
        f"Cleared mapping for {'event ' + event_id if event_id else 'module ' + module_id}"
    )


@curriculums_app.command("duplicate")
def duplicate_curriculum(
    curriculum_id: str = typer.Argument(..., help="Curriculum id to clone."),
    overrides: str = typer.Option(
        None,
        "--overrides",
        help="JSON object overriding the clone's fields (defaults to the source's).",
    ),
) -> None:
    """Deep-clone a curriculum (syllabuses, modules, events, mappings)."""
    with state.client() as client:
        result = client.post(
            f"{_BASE}/curriculums/{curriculum_id}/duplicate",
            json=parse_json(overrides, what="--overrides") or {},
        )
    success(f"Duplicated curriculum {curriculum_id}")
    show(result)


@curriculums_app.command("cut-status")
def cut_status(
    curriculum_id: str = typer.Argument(..., help="Curriculum id."),
) -> None:
    """Show whether the curriculum's linked iteration currently holds cut events."""
    with state.client() as client:
        show(client.get(f"{_BASE}/curriculums/{curriculum_id}/cut"), title="Cut status")


def _cut_payload(
    force: bool,
    auto_spillover: bool,
    insert_breaks: bool,
    accepted_constraint_moves: str | None,
    week_overflow_resolutions: str | None,
) -> dict:
    """Build the body both /cut and /cut/plan take.

    The route reads five fields. The CLI used to send only `force`, so every
    other decision silently took the server default and the plan-then-confirm
    flow was unreachable from a terminal.
    """
    moves = parse_json(accepted_constraint_moves, what="--accepted-constraint-moves")
    if moves is not None and not isinstance(moves, list):
        raise typer.BadParameter("--accepted-constraint-moves must be a JSON array.")

    resolutions = parse_json(
        week_overflow_resolutions, what="--week-overflow-resolutions"
    )
    if resolutions is not None and not isinstance(resolutions, dict):
        raise typer.BadParameter("--week-overflow-resolutions must be a JSON object.")

    return {
        "force": force,
        "autoSpillover": auto_spillover,
        "insertBreaks": insert_breaks,
        "acceptedConstraintMoves": moves if moves is not None else [],
        "weekOverflowResolutions": resolutions if resolutions is not None else {},
    }


FORCE_OPTION = typer.Option(
    False, "--force", help="Re-cut a curriculum that was already cut."
)
AUTO_SPILLOVER_OPTION = typer.Option(
    True,
    "--auto-spillover/--no-auto-spillover",
    help="Let the planner spill work into later weeks. Server default: on.",
)
INSERT_BREAKS_OPTION = typer.Option(
    True,
    "--insert-breaks/--no-insert-breaks",
    help="Insert breaks between occurrences. Server default: on.",
)
ACCEPTED_MOVES_OPTION = typer.Option(
    None,
    "--accepted-constraint-moves",
    help="JSON array of constraint moves to accept, as returned by cut-plan.",
)
WEEK_OVERFLOW_OPTION = typer.Option(
    None,
    "--week-overflow-resolutions",
    help="JSON object of week-overflow answers, as returned by cut-plan.",
)


@curriculums_app.command("cut-preview")
def cut_preview(
    curriculum_id: str = typer.Argument(..., help="Curriculum id."),
) -> None:
    """Dry-run the cut: the planner's dated occurrences, with no gating and no writes."""
    with state.client() as client:
        show(client.get(f"{_BASE}/curriculums/{curriculum_id}/cut/preview"))


@curriculums_app.command("cut")
def cut_curriculum(
    curriculum_id: str = typer.Argument(..., help="Curriculum id."),
    force: bool = FORCE_OPTION,
    auto_spillover: bool = AUTO_SPILLOVER_OPTION,
    insert_breaks: bool = INSERT_BREAKS_OPTION,
    accepted_constraint_moves: str = ACCEPTED_MOVES_OPTION,
    week_overflow_resolutions: str = WEEK_OVERFLOW_OPTION,
    yes: bool = typer.Option(False, "--yes", "-y", help="Skip confirmation."),
) -> None:
    """Materialize a published, linked curriculum into schedule events.

    The body used to carry only `force`, so the other four fields the route
    reads always took their server defaults and the plan-then-confirm flow was
    unreachable from a terminal. Run `cut-plan` first, then feed its
    `report.decisions` back through --accepted-constraint-moves and
    --week-overflow-resolutions.

    Gating failures come back coded — `draft`, `no-iteration`, `already-cut`,
    `foreign-cut` (409) or `invalid-plan` (400) — and nothing is written when
    they fire. `foreign-cut` means the linked iteration still holds a live cut
    of a *different* curriculum; pull that one back first.
    """
    if not yes:
        typer.confirm(
            f"Cut curriculum {curriculum_id} into its linked iteration?", abort=True
        )
    payload = _cut_payload(
        force,
        auto_spillover,
        insert_breaks,
        accepted_constraint_moves,
        week_overflow_resolutions,
    )
    with state.client() as client:
        result = client.post(f"{_BASE}/curriculums/{curriculum_id}/cut", json=payload)
    success(f"Cut curriculum {curriculum_id}")
    show(result)


@curriculums_app.command("pull-back")
def pull_back_cut(
    curriculum_id: str = typer.Argument(..., help="Curriculum id."),
    yes: bool = typer.Option(False, "--yes", "-y", help="Skip confirmation."),
) -> None:
    """Undo a cut — soft-delete every live schedule event generated for it."""
    if not yes:
        typer.confirm(
            f"Pull back the cut schedule for curriculum {curriculum_id}?", abort=True
        )
    with state.client() as client:
        result = client.delete(f"{_BASE}/curriculums/{curriculum_id}/cut")
    success(f"Pulled back cut for curriculum {curriculum_id}")
    show(result)


@curriculums_app.command("execution")
def curriculum_execution(
    curriculum_id: str = typer.Argument(..., help="Curriculum id."),
) -> None:
    """תכנון מול ביצוע — compare the gantt plan against the events cut from it.

    A curriculum that has not been cut (or has no linked iteration) answers
    `{"events": {}}` rather than erroring.
    """
    with state.client() as client:
        show(client.get(f"{_BASE}/curriculums/{curriculum_id}/execution"))


@curriculums_app.command("recurrence-exceptions")
def curriculum_recurrence_exceptions(
    curriculum_id: str = typer.Argument(..., help="Curriculum id."),
    limit: int = LIMIT_OPTION,
    offset: int = OFFSET_OPTION,
) -> None:
    """List every recurrence exception recorded for a curriculum."""
    with state.client() as client:
        show(
            client.get(f"{_BASE}/curriculums/{curriculum_id}/recurrence-exceptions"),
            title="Recurrence exceptions",
            limit=limit,
            offset=offset,
        )


# --- gantt-event-specific extras --------------------------------------------


@events_app.command("duplicate")
def duplicate_event(
    event_id: str = typer.Argument(..., help="Gantt event id to clone."),
    module_id: str = typer.Option(
        ..., "--module-id", help="Module the copy is created under."
    ),
) -> None:
    """Clone a gantt event into a module (the copy gets the next indexed title)."""
    with state.client() as client:
        result = client.post(
            f"{_BASE}/events/{event_id}/duplicate", json={"moduleId": module_id}
        )
    success(f"Duplicated event {event_id}")
    show(result)


@events_app.command("except-occurrence")
def except_occurrence(
    event_id: str = typer.Argument(..., help="Recurring gantt event id."),
    curriculum_id: str = typer.Option(..., "--curriculum-id", help="Curriculum id."),
    day_id: str = typer.Option(..., "--day-id", help="Day the occurrence falls on."),
) -> None:
    """Drop a single occurrence of a recurring event; it keeps recurring elsewhere."""
    with state.client() as client:
        result = client.post(
            f"{_BASE}/events/{event_id}/recurrence-exceptions",
            json={"curriculumId": curriculum_id, "dayId": day_id},
        )
    success(f"Excepted event {event_id} from day {day_id}")
    show(result)


@events_app.command("materialize")
def materialize_occurrence(
    event_id: str = typer.Argument(..., help="Recurring gantt event id."),
    curriculum_id: str = typer.Option(..., "--curriculum-id", help="Curriculum id."),
    module_id: str = typer.Option(..., "--module-id", help="Module id."),
    day_id: str = typer.Option(..., "--day-id", help="Day the occurrence falls on."),
) -> None:
    """Turn one recurring occurrence into a standalone event and except the source."""
    with state.client() as client:
        result = client.post(
            f"{_BASE}/events/{event_id}/materialize",
            json={
                "curriculumId": curriculum_id,
                "moduleId": module_id,
                "dayId": day_id,
            },
        )
    success(f"Materialized event {event_id} onto day {day_id}")
    show(result)


# --- cut planning and shuffles ----------------------------------------------


@curriculums_app.command("cut-plan")
def cut_plan(
    curriculum_id: str = typer.Argument(..., help="Curriculum id."),
    force: bool = FORCE_OPTION,
    auto_spillover: bool = AUTO_SPILLOVER_OPTION,
    insert_breaks: bool = INSERT_BREAKS_OPTION,
    accepted_constraint_moves: str = ACCEPTED_MOVES_OPTION,
    week_overflow_resolutions: str = WEEK_OVERFLOW_OPTION,
) -> None:
    """Plan the cut without writing: what the commit would do, plus open decisions.

    This is the first half of the plan-then-confirm flow the dialog uses. Run
    it, read `report.decisions`, then pass your answers to `cut` via
    --accepted-constraint-moves / --week-overflow-resolutions.

    Unlike cut-preview, this runs the full pipeline — balance, constraints and
    breaks — and applies the same gating as the commit, so `draft` and
    `no-iteration` still come back as 409 without writing anything.
    """
    payload = _cut_payload(
        force,
        auto_spillover,
        insert_breaks,
        accepted_constraint_moves,
        week_overflow_resolutions,
    )
    with state.client() as client:
        show(client.post(f"{_BASE}/curriculums/{curriculum_id}/cut/plan", json=payload))


@syllabuses_app.command("shuffles")
def syllabus_shuffle_usages(
    syllabus_id: str = typer.Argument(..., help="Syllabus id."),
    names: str = typer.Option(
        ..., "--names", help="Comma-separated shuffle names to look up."
    ),
) -> None:
    """Modules and events using these shuffle names — what a deletion would strip."""
    with state.client() as client:
        show(
            client.get(
                f"{_BASE}/syllabuses/{syllabus_id}/shuffles", params={"names": names}
            ),
            title=f"Shuffle usages for syllabus {syllabus_id}",
        )


@syllabuses_app.command("set-links")
def syllabus_set_links(
    syllabus_id: str = typer.Argument(..., help="Syllabus id."),
    courses: str | None = typer.Option(
        None,
        "--courses",
        help="Comma-separated course ids (מסלולים). Empty string clears.",
    ),
    leads: str | None = typer.Option(
        None,
        "--leads",
        help="Comma-separated Hive instructor ids (אחראי מקצוע). Empty string clears.",
    ),
) -> None:
    """Set the courses and/or lead instructors a syllabus is linked to (#702).

    Omitted options are left untouched; pass an empty string to clear one.
    """
    payload: dict[str, list[str] | list[int]] = {}
    if courses is not None:
        payload["courseIds"] = [c.strip() for c in courses.split(",") if c.strip()]
    if leads is not None:
        payload["leadInstructorIds"] = [
            int(i.strip()) for i in leads.split(",") if i.strip()
        ]
    if not payload:
        raise typer.BadParameter("Pass --courses and/or --leads.")
    with state.client() as client:
        result = client.patch(f"{_BASE}/syllabuses/{syllabus_id}", json=payload)
    success(f"Updated links on syllabus {syllabus_id}")
    show(result)


@syllabuses_app.command("set-shuffles")
def syllabus_set_shuffles(
    syllabus_id: str = typer.Argument(..., help="Syllabus id."),
    shuffles: str = typer.Option(
        ...,
        "--shuffles",
        help="Comma-separated shuffle names. Pass an empty string to clear them all.",
    ),
    yes: bool = typer.Option(False, "--yes", "-y", help="Skip confirmation."),
) -> None:
    """Replace a syllabus's shuffle list, cascading removals onto modules and events.

    This is destructive for anything using a name you drop — run `shuffles`
    first to see what that would strip.
    """
    names = [name.strip() for name in shuffles.split(",") if name.strip()]
    if not yes:
        typer.confirm(
            f"Set syllabus {syllabus_id} shuffles to {names or 'none'}? "
            "Modules and events using removed names lose them.",
            abort=True,
        )
    with state.client() as client:
        result = client.post(
            f"{_BASE}/syllabuses/{syllabus_id}/shuffles", json={"shuffles": names}
        )
    success(f"Set {len(names)} shuffle(s) on syllabus {syllabus_id}")
    show(result)


# --- register entity apps ---------------------------------------------------

_ENTITIES: list[tuple[str, typer.Typer]] = [
    ("curriculums", curriculums_app),
    ("syllabuses", syllabuses_app),
    ("modules", modules_app),
    ("events", events_app),
    ("days", days_app),
    ("weeks", weeks_app),
]

for _name, _child in _ENTITIES:
    app.add_typer(_child, name=_name)
