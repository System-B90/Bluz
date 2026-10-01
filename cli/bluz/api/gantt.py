"""
Name: gantt.py
Purpose: `bz.gantt` — the curriculum engine. One generic entity API gives
         every Gantt collection the same CRUD surface (DRY); each subclass
         adds what only its entity has (linking, time allocation, reordering,
         and the curriculum's export / mapping / cut pipeline).
         Mirrors ui/src/api-client/gantt/*.
Created: 2026-10-02
Author: Michael K. Steinberg
"""

from __future__ import annotations

from collections.abc import Iterator, Mapping
from typing import TYPE_CHECKING, Any, ClassVar, Generic, TypeVar

from bluz.api._base import Resource, ref, refs
from bluz.errors import BluzApiError, NotFoundError
from bluz.models._base import Collection, camel_payload
from bluz.models.gantt import (
    Curriculum,
    Day,
    DayMapping,
    GanttEvent,
    GanttNode,
    GanttSummary,
    Module,
    RecurrenceException,
    Syllabus,
    Week,
)
from bluz.models.misc import (
    CurriculumExecution,
    CutPlan,
    CutResult,
    CutStatus,
    ShuffleUsages,
)

if TYPE_CHECKING:
    from bluz.models.directory import Course
    from bluz.sdk import Bluz

__all__ = [
    "CurriculumsAPI",
    "DaysAPI",
    "GanttAPI",
    "GanttEntityAPI",
    "GanttEventsAPI",
    "ModulesAPI",
    "SyllabusesAPI",
    "WeeksAPI",
]

_BASE = "/api/gantt"

N = TypeVar("N", bound=GanttNode)


class GanttEntityAPI(Resource, Generic[N]):
    """CRUD shared by every Gantt collection.

    * `list()` — cheap `{id, title}` rows (`GanttSummary`).
    * `get(id)` — the full object with its sub-tree.
    * `api["Title"]` — the full object, looked up by title or id.
    * `for item in api` — every full object (one request each).
    """

    entity: ClassVar[str] = ""
    model: ClassVar[type[GanttNode]] = GanttNode

    def list(self, *, with_parents: bool = False) -> Collection[GanttSummary]:
        """`{id, title}` for every item (plus parent ids with `with_parents`)."""
        items = self._http.get(
            f"{_BASE}/{self.entity}",
            params={"withParents": 1 if with_parents else None},
        )
        rows: Collection[GanttSummary] = Collection()
        for item_id, value in (items or {}).items():
            data = (
                {"id": item_id, **value}
                if isinstance(value, dict)
                else {
                    "id": item_id,
                    "title": value,
                }
            )
            row = GanttSummary.from_wire(data, self._bluz)
            row._entity = self.entity
            rows.append(row)
        return rows

    def get(self, item: N | GanttSummary | str) -> N:
        """One item with its full sub-tree."""
        return self._one(
            self.model, self._http.get(f"{_BASE}/{self.entity}/{ref(item)}")
        )  # type: ignore[return-value]

    def get_many(self, *ids: str) -> Collection[N]:
        """Several items by id (flat — children as id lists, not trees)."""
        items = self._http.get(f"{_BASE}/{self.entity}", params={"ids": ",".join(ids)})
        return self._many(self.model, list((items or {}).values()))  # type: ignore[return-value]

    def __getitem__(self, key: str) -> N:
        found = self.list().find(key)
        if found is None:
            raise NotFoundError(f"No {self.entity} matching {key!r}.")
        return self.get(found.id)

    def __iter__(self) -> Iterator[N]:
        for row in self.list():
            yield self.get(row.id)

    def create(self, data: Mapping[str, Any] | None = None, /, **fields: Any) -> N:
        """Create from a wire dict and/or snake_case fields."""
        payload = camel_payload(data, **fields)
        return self._one(
            self.model, self._http.post(f"{_BASE}/{self.entity}", json=payload)
        )  # type: ignore[return-value]

    def update(
        self, item: N | str, data: Mapping[str, Any] | None = None, /, **fields: Any
    ) -> N:
        """PATCH fields from a wire dict and/or snake_case fields."""
        payload = camel_payload(data, **fields)
        return self._one(
            self.model,
            self._http.patch(f"{_BASE}/{self.entity}/{ref(item)}", json=payload),
        )  # type: ignore[return-value]

    def delete(self, item: N | str) -> None:
        self._http.delete(f"{_BASE}/{self.entity}/{ref(item)}")


class _LinkMixin(GanttEntityAPI[N]):
    def link(self, item: N | str, new_parent: GanttNode | str) -> Any:
        """Attach an item under a(nother) parent."""
        return self._http.post(
            f"{_BASE}/{self.entity}/{ref(item)}/link",
            json={"newParentId": ref(new_parent)},
        )

    def unlink(self, item: N | str, old_parent: GanttNode | str) -> None:
        """Detach an item from a parent."""
        self._http.delete(
            f"{_BASE}/{self.entity}/{ref(item)}/link",
            json={"oldParentId": ref(old_parent)},
        )


class _AllocateMixin(GanttEntityAPI[N]):
    def get_time(self, item: N | str, curriculum: Curriculum | str) -> Any:
        """Allocated minutes within a curriculum."""
        return self._http.get(
            f"{_BASE}/{self.entity}/{ref(item)}/allocate-time",
            params={"containerId": ref(curriculum)},
        )

    def set_time(
        self, item: N | str, curriculum: Curriculum | str, duration: int
    ) -> None:
        """Set allocated minutes within a curriculum."""
        self._http.post(
            f"{_BASE}/{self.entity}/{ref(item)}/allocate-time",
            json={"containerId": ref(curriculum), "duration": duration},
        )


class _ReorderMixin(GanttEntityAPI[N]):
    reorder_route: ClassVar[str] = ""
    reorder_key: ClassVar[str] = ""

    def reorder(self, item: N | str, children: list[Any]) -> None:
        """Set the order of an item's children (ids or objects)."""
        self._http.post(
            f"{_BASE}/{self.entity}/{ref(item)}/{self.reorder_route}",
            json={self.reorder_key: refs(children)},
        )


class CurriculumsAPI(GanttEntityAPI[Curriculum]):
    """`bz.gantt.curriculums`.

    Example:
        >>> cur = bz.gantt.curriculums["Bis90 2026"]
        >>> copy = cur.duplicate(title="Bis90 2026 (draft)")
        >>> plan = bz.gantt.curriculums.cut_plan(cur)
    """

    entity = "curriculums"
    model = Curriculum

    def create(  # type: ignore[override]
        self,
        data: Mapping[str, Any] | None = None,
        /,
        *,
        title: str | None = None,
        description: str = "",
        start_date: str | None = None,
        is_draft: bool = True,
        is_archived: bool = False,
        **fields: Any,
    ) -> Curriculum:
        if data is None:
            data = {
                "description": description,
                "startDate": start_date,
                "isDraft": is_draft,
                "isArchived": is_archived,
            }
        return super().create(data, title=title, **fields)

    def export(self, curriculum: Curriculum | str) -> dict[str, Any]:
        """Portable JSON export (curriculum + mappings + constraints)."""
        return self._http.get(f"{_BASE}/curriculums/{ref(curriculum)}/export")

    def export_excel(self, curriculum: Curriculum | str) -> bytes:
        """The curriculum as an .xlsx workbook."""
        data = self._http.get(f"{_BASE}/curriculums/{ref(curriculum)}/export/excel")
        if not isinstance(data, bytes):
            raise BluzApiError(
                "InvalidResponse",
                f"Expected an .xlsx byte stream, got {type(data).__name__}: {str(data)[:200]}",
            )
        return data

    def import_(self, exported: Mapping[str, Any]) -> Any:
        """Import a curriculum from an `export()` document."""
        return self._http.post(f"{_BASE}/curriculums/import", json=dict(exported))

    def duplicate(
        self,
        curriculum: Curriculum | str,
        overrides: Mapping[str, Any] | None = None,
        /,
        **fields: Any,
    ) -> Curriculum:
        """Deep-clone (syllabuses, modules, events, mappings)."""
        return self._one(
            Curriculum,
            self._http.post(
                f"{_BASE}/curriculums/{ref(curriculum)}/duplicate",
                json=camel_payload(overrides, **fields),
            ),
        )

    def constraints(
        self,
        curriculum: Curriculum | str,
        *,
        syllabus: Syllabus | str | None = None,
        module: Module | str | None = None,
    ) -> Any:
        params = {"syllabusId": ref(syllabus), "moduleId": ref(module)}
        return self._http.get(
            f"{_BASE}/curriculums/{ref(curriculum)}/constraints", params=params
        )

    # --- day mappings (cMDA) ---------------------------------------------------

    def mappings(self, curriculum: Curriculum | str) -> Collection[DayMapping]:
        return self._many(
            DayMapping,
            self._http.get(f"{_BASE}/curriculums/{ref(curriculum)}/mappings"),
        )

    def set_mapping(
        self,
        curriculum: Curriculum | str,
        module: Module | str,
        day: Day | str,
        *,
        event: GanttEvent | str | None = None,
        sort_order: float | None = None,
    ) -> Any:
        """Place a module (or one of its events) on a day."""
        payload: dict[str, Any] = {"moduleId": ref(module), "dayId": ref(day)}
        if event is not None:
            payload["eventId"] = ref(event)
        if sort_order is not None:
            payload["sortOrder"] = sort_order
        return self._http.post(
            f"{_BASE}/curriculums/{ref(curriculum)}/mappings", json=payload
        )

    def move_mapping(
        self,
        curriculum: Curriculum | str,
        module: Module | str,
        old_day: Day | str,
        *,
        new_day: Day | str | None = None,
        event: GanttEvent | str | None = None,
        sort_order: float | None = None,
    ) -> Any:
        """Move a mapping to another day and/or change its order."""
        new_values: dict[str, Any] = {}
        if new_day is not None:
            new_values["dayId"] = ref(new_day)
        if sort_order is not None:
            new_values["sortOrder"] = sort_order
        if not new_values:
            raise ValueError("Pass new_day and/or sort_order.")
        payload = {
            "moduleId": ref(module),
            "eventId": ref(event),
            "oldMapping": {"dayId": ref(old_day)},
            "newValues": new_values,
        }
        return self._http.patch(
            f"{_BASE}/curriculums/{ref(curriculum)}/mappings", json=payload
        )

    def unset_mapping(
        self,
        curriculum: Curriculum | str,
        module: Module | str,
        day: Day | str,
        *,
        event: GanttEvent | str | None = None,
    ) -> None:
        payload = {"moduleId": ref(module), "eventId": ref(event), "dayId": ref(day)}
        self._http.delete(
            f"{_BASE}/curriculums/{ref(curriculum)}/mappings", json=payload
        )

    # --- cut pipeline ------------------------------------------------------------

    @staticmethod
    def _cut_payload(
        force: bool,
        auto_spillover: bool,
        insert_breaks: bool,
        accepted_constraint_moves: list[Any] | None,
        week_overflow_resolutions: Mapping[str, Any] | None,
    ) -> dict[str, Any]:
        return {
            "force": force,
            "autoSpillover": auto_spillover,
            "insertBreaks": insert_breaks,
            "acceptedConstraintMoves": list(accepted_constraint_moves or []),
            "weekOverflowResolutions": dict(week_overflow_resolutions or {}),
        }

    def cut_status(self, curriculum: Curriculum | str) -> CutStatus:
        """Whether the linked iteration currently holds cut events."""
        return self._one(
            CutStatus, self._http.get(f"{_BASE}/curriculums/{ref(curriculum)}/cut")
        )

    def cut_preview(self, curriculum: Curriculum | str) -> Any:
        """Planner's dated occurrences — no gating, no writes."""
        return self._http.get(f"{_BASE}/curriculums/{ref(curriculum)}/cut/preview")

    def cut_plan(
        self,
        curriculum: Curriculum | str,
        *,
        force: bool = False,
        auto_spillover: bool = True,
        insert_breaks: bool = True,
        accepted_constraint_moves: list[Any] | None = None,
        week_overflow_resolutions: Mapping[str, Any] | None = None,
    ) -> CutPlan:
        """Full dry run of the cut with the commit's gating. Read
        `plan.report["decisions"]`, then pass your answers to `cut()`."""
        payload = self._cut_payload(
            force,
            auto_spillover,
            insert_breaks,
            accepted_constraint_moves,
            week_overflow_resolutions,
        )
        return self._one(
            CutPlan,
            self._http.post(
                f"{_BASE}/curriculums/{ref(curriculum)}/cut/plan", json=payload
            ),
        )

    def cut(
        self,
        curriculum: Curriculum | str,
        *,
        force: bool = False,
        auto_spillover: bool = True,
        insert_breaks: bool = True,
        accepted_constraint_moves: list[Any] | None = None,
        week_overflow_resolutions: Mapping[str, Any] | None = None,
    ) -> CutResult:
        """Materialize a published, linked curriculum into calendar events.

        Gating failures raise `BluzApiError` (`draft`, `no-iteration`,
        `already-cut`, `foreign-cut`, `invalid-plan`) and write nothing.
        """
        payload = self._cut_payload(
            force,
            auto_spillover,
            insert_breaks,
            accepted_constraint_moves,
            week_overflow_resolutions,
        )
        return self._one(
            CutResult,
            self._http.post(f"{_BASE}/curriculums/{ref(curriculum)}/cut", json=payload),
        )

    def pull_back(self, curriculum: Curriculum | str) -> Any:
        """Undo a cut — soft-delete every live event generated for it."""
        return self._http.delete(f"{_BASE}/curriculums/{ref(curriculum)}/cut")

    def execution(self, curriculum: Curriculum | str) -> CurriculumExecution:
        """Planned vs. actual (תכנון מול ביצוע)."""
        return self._one(
            CurriculumExecution,
            self._http.get(f"{_BASE}/curriculums/{ref(curriculum)}/execution"),
        )

    def recreate_occurrence(
        self,
        curriculum: Curriculum | str,
        gantt_event: GanttEvent | str,
        occurrence_date: str,
    ) -> Any:
        """Re-create the calendar event of one deleted cut occurrence."""
        return self._http.post(
            f"{_BASE}/curriculums/{ref(curriculum)}/execution/recreate",
            json={"ganttEventId": ref(gantt_event), "occurrenceDate": occurrence_date},
        )

    def recurrence_exceptions(
        self, curriculum: Curriculum | str
    ) -> Collection[RecurrenceException]:
        return self._many(
            RecurrenceException,
            self._http.get(
                f"{_BASE}/curriculums/{ref(curriculum)}/recurrence-exceptions"
            ),
        )


class SyllabusesAPI(_LinkMixin[Syllabus], _ReorderMixin[Syllabus]):
    """`bz.gantt.syllabuses`."""

    entity = "syllabuses"
    model = Syllabus
    reorder_route = "reorder-modules"
    reorder_key = "moduleIds"

    def shuffle_usages(
        self, syllabus: Syllabus | str, names: list[str]
    ) -> ShuffleUsages:
        """Modules and events using these shuffle names."""
        return self._one(
            ShuffleUsages,
            self._http.get(
                f"{_BASE}/syllabuses/{ref(syllabus)}/shuffles",
                params={"names": ",".join(names)},
            ),
        )

    def set_shuffles(
        self,
        syllabus: Syllabus | str,
        names: list[str],
        descriptions: Mapping[str, str] | None = None,
    ) -> Any:
        """Replace the shuffle list. Destructive for anything using a dropped name."""
        payload: dict[str, Any] = {"shuffles": list(names)}
        if descriptions:
            payload["descriptions"] = dict(descriptions)
        return self._http.post(
            f"{_BASE}/syllabuses/{ref(syllabus)}/shuffles", json=payload
        )

    def set_links(
        self,
        syllabus: Syllabus | str,
        *,
        courses: list[Course | str] | None = None,
        lead_instructor_ids: list[int] | None = None,
    ) -> Syllabus:
        """Set linked courses and/or lead instructors. `[]` clears; None leaves alone."""
        payload: dict[str, Any] = {}
        if courses is not None:
            payload["courseIds"] = refs(courses)
        if lead_instructor_ids is not None:
            payload["leadInstructorIds"] = list(lead_instructor_ids)
        if not payload:
            raise ValueError("Pass courses and/or lead_instructor_ids.")
        return self.update(syllabus, payload)


class ModulesAPI(_LinkMixin[Module], _AllocateMixin[Module], _ReorderMixin[Module]):
    """`bz.gantt.modules`."""

    entity = "modules"
    model = Module
    reorder_route = "reorder-events"
    reorder_key = "eventIds"


class GanttEventsAPI(_LinkMixin[GanttEvent], _AllocateMixin[GanttEvent]):
    """`bz.gantt.events`."""

    entity = "events"
    model = GanttEvent

    def duplicate(self, event: GanttEvent | str, module: Module | str) -> GanttEvent:
        """Clone into `module`; the copy gets the next indexed title."""
        return self._one(
            GanttEvent,
            self._http.post(
                f"{_BASE}/events/{ref(event)}/duplicate", json={"moduleId": ref(module)}
            ),
        )

    def except_occurrence(
        self, event: GanttEvent | str, curriculum: Curriculum | str, day: Day | str
    ) -> Any:
        """Drop one occurrence of a recurring event."""
        return self._http.post(
            f"{_BASE}/events/{ref(event)}/recurrence-exceptions",
            json={"curriculumId": ref(curriculum), "dayId": ref(day)},
        )

    def materialize(
        self,
        event: GanttEvent | str,
        curriculum: Curriculum | str,
        module: Module | str,
        day: Day | str,
    ) -> Any:
        """Turn one recurring occurrence into a standalone event."""
        return self._http.post(
            f"{_BASE}/events/{ref(event)}/materialize",
            json={
                "curriculumId": ref(curriculum),
                "moduleId": ref(module),
                "dayId": ref(day),
            },
        )

    def set_shuffle_group(
        self, event: GanttEvent | str, module: Module | str, shuffles: list[str]
    ) -> Any:
        """Reconcile the event's shuffle group to exactly these names."""
        return self._http.post(
            f"{_BASE}/events/{ref(event)}/shuffle-group",
            json={"moduleId": ref(module), "shuffles": list(shuffles)},
        )


class WeeksAPI(GanttEntityAPI[Week]):
    """`bz.gantt.weeks`."""

    entity = "weeks"
    model = Week


class DaysAPI(GanttEntityAPI[Day]):
    """`bz.gantt.days`."""

    entity = "days"
    model = Day


class GanttAPI:
    """`bz.gantt` — namespaces for every Gantt entity.

    Example:
        >>> for cur in bz.gantt.curriculums: print(cur.title, len(cur))
    """

    def __init__(self, bluz: Bluz) -> None:
        self.curriculums = CurriculumsAPI(bluz)
        self.syllabuses = SyllabusesAPI(bluz)
        self.modules = ModulesAPI(bluz)
        self.events = GanttEventsAPI(bluz)
        self.weeks = WeeksAPI(bluz)
        self.days = DaysAPI(bluz)

    def entity(self, name: str) -> GanttEntityAPI[Any]:
        """The API for an entity collection name ("curriculums", "modules", ...)."""
        api = getattr(self, name, None)
        if not isinstance(api, GanttEntityAPI):
            raise KeyError(name)
        return api

    def __repr__(self) -> str:
        return "<GanttAPI: curriculums, syllabuses, modules, events, weeks, days>"
