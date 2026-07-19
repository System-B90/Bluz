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

from bluz_cli.commands._common import LIMIT_OPTION, OFFSET_OPTION, parse_json, show
from bluz_cli.context import state
from bluz_cli.errors import BluzApiError
from bluz_cli.output import success

app = typer.Typer(help="Gantt / curriculum engine.", no_args_is_help=True)

_BASE = "/api/gantt"


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
        limit: int = LIMIT_OPTION,
        offset: int = OFFSET_OPTION,
    ) -> None:
        """List items as an array of {id, title} (server returns an id→title map)."""
        with state.client() as client:
            items = client.get(base)
        rows = [{"id": item_id, "title": title} for item_id, title in items.items()]
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
        success(f"Created {entity[:-1] if entity.endswith('s') else entity}")
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
days_app = _entity_app("days", help_text="Curriculum days.", link=True)
weeks_app = _entity_app("weeks", help_text="Curriculum weeks.", link=True)


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
        output.write_text(
            json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8"
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
    output.write_bytes(data)
    success(f"Exported curriculum {curriculum_id} → {output} ({len(data)} bytes)")


@curriculums_app.command("import")
def import_curriculum(
    file: Path = typer.Argument(..., help="Path to an exported curriculum JSON file."),
) -> None:
    """Import a curriculum from an export file."""
    payload = json.loads(file.read_text(encoding="utf-8"))
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
