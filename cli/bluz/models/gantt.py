"""
Name: gantt.py
Purpose: Gantt / curriculum engine models, navigable as a tree:
         Curriculum → Syllabus → Module → GanttEvent, and Curriculum → Week →
         Day. One `bz.gantt.curriculums.get(id)` call returns the whole tree;
         every level iterates over its children and looks them up by title.
         Mirrors ui/src/api-shared/types/gantt/*.
Created: 2026-10-02
Author: Michael K. Steinberg
"""

from __future__ import annotations

from collections.abc import Iterator
from datetime import datetime
from enum import IntEnum, StrEnum
from typing import (
    TYPE_CHECKING,
    Annotated,
    Any,
    ClassVar,
    Generic,
    Self,
    TypeVar,
    cast,
    overload,
)

from pydantic import Field, PrivateAttr

from bluz.errors import NotFoundError
from bluz.models._base import ENUM_FIRST as _ENUM_FIRST
from bluz.models._base import HHMM, BluzModel, Collection, LenientDate

if TYPE_CHECKING:
    from rich.tree import Tree

    from bluz.api.gantt import GanttEntityAPI
    from bluz.models.directory import Course
    from bluz.models.misc import (
        CurriculumExecution,
        CutPlan,
        CutResult,
        CutStatus,
        ShuffleUsages,
    )

__all__ = [
    "Curriculum",
    "Day",
    "DayMapping",
    "EventCurriculumAllocation",
    "EventRecurrence",
    "GanttDayIndex",
    "GanttEvent",
    "GanttNode",
    "GanttSummary",
    "Module",
    "ModuleEventType",
    "RecurrenceException",
    "RoomRequirement",
    "Syllabus",
    "Week",
]


class ModuleEventType(StrEnum):
    """Gantt event kinds (values are the Hebrew labels the server stores)."""

    LECTURE = "הרצאה"
    EXERCISE = 'ע"ע'
    SELF_TEACHING = 'ל"ע'
    OTHER = "אחר"


class RoomRequirement(StrEnum):
    CLASSIFIED = "בחדר מסווג"
    OUTSIDE = "בחוץ"
    MULTIPLE_CLASSROOMS = "כמה כיתות"
    OFF_BASE = "מחוץ לבסיס"
    ONLINE = "באופן מקוון"


class EventRecurrence(StrEnum):
    NONE = "none"
    DAILY = "daily"
    WEEKLY = "weekly"


class GanttDayIndex(IntEnum):
    SUNDAY = 0
    MONDAY = 1
    TUESDAY = 2
    WEDNESDAY = 3
    THURSDAY = 4
    FRIDAY = 5
    SATURDAY = 6


# --- shared plumbing --------------------------------------------------------


class GanttSummary(BluzModel):
    """A row of a Gantt `list()` — just id and title (plus parent ids when asked).

    Call `.get()` for the full object.
    """

    _repr_fields: ClassVar[tuple[str, ...]] = ("id", "title")

    id: str
    title: str | int | None = None
    _entity: str = PrivateAttr(default="")

    def get(self) -> GanttNode:
        """Fetch the full entity this row names."""
        return cast(GanttNode, self.bluz.gantt.entity(self._entity).get(self.id))


ChildT = TypeVar("ChildT", bound="GanttNode")


class GanttNode(BluzModel):
    """Base of every Gantt entity: id + title, refresh/update/delete, and a
    back-reference to the parent it was reached through."""

    _repr_fields: ClassVar[tuple[str, ...]] = ("id", "title")
    # Collection name on /api/gantt/<entity>; set by each subclass.
    _entity: ClassVar[str] = ""

    id: str
    title: str = ""
    created_at: datetime | None = None
    updated_at: datetime | None = None

    _parent: GanttNode | None = PrivateAttr(default=None)

    def _api(self) -> GanttEntityAPI[Any]:
        return self.bluz.gantt.entity(self._entity)

    def refresh(self) -> Self:
        """Re-fetch this entity (with its full sub-tree)."""
        return cast(Self, self._api().get(self.id))

    def update(self, data: dict[str, Any] | None = None, /, **fields: Any) -> Self:
        """PATCH fields (snake_case kwargs or a camelCase dict). Returns the result."""
        return cast(Self, self._api().update(self.id, data, **fields))

    def delete(self) -> None:
        self._api().delete(self.id)


class _Container(GanttNode, Generic[ChildT]):
    """A Gantt node with ordered children: iterable, sized, indexable by
    position, id or title."""

    def _children(self) -> Collection[ChildT]:
        raise NotImplementedError

    def __iter__(self) -> Iterator[ChildT]:  # type: ignore[override]
        return iter(self._children())

    def __len__(self) -> int:
        return len(self._children())

    def __contains__(self, item: object) -> bool:
        if isinstance(item, str):
            return self._children().find(item) is not None
        return item in self._children()

    @overload
    def __getitem__(self, key: int) -> ChildT: ...
    @overload
    def __getitem__(self, key: str) -> ChildT: ...
    def __getitem__(self, key: int | str) -> ChildT:
        try:
            return self._children()[key]
        except KeyError:
            raise NotFoundError(
                f"{type(self).__name__} {self.title!r} has no child {key!r}"
            ) from None

    def _repr_items(self) -> list[tuple[str, Any]]:
        items = super()._repr_items()
        if self._tree_loaded():
            items.append(("children", len(self._children())))
        return items

    def _tree_loaded(self) -> bool:
        return True

    def tree(self) -> Tree:
        """A `rich.tree.Tree` of this node and everything below it.

        `rich.print(curriculum.tree())` in a terminal; IPython shows it as-is.
        """
        from rich.tree import Tree

        root = Tree(f"[bold]{self.title}[/bold] [dim]{self.id}[/dim]")
        _fill_tree(root, self)
        return root


def _fill_tree(branch: Tree, node: GanttNode) -> None:
    if not isinstance(node, _Container):
        return
    for child in node:
        label = f"{child.title} [dim]{child.id}[/dim]"
        if isinstance(child, GanttEvent):
            label += f" [cyan]{child.minimum_duration}m[/cyan]"
        _fill_tree(branch.add(label), child)


def _bind_parent(children: list[GanttNode], parent: GanttNode) -> None:
    for child in children:
        child._parent = parent


# --- events -----------------------------------------------------------------


class EventCurriculumAllocation(BluzModel):
    """How long a Gantt event is allocated in one curriculum (minutes)."""

    _repr_fields = ("curriculum_id", "allocated_duration")

    event_id: str | None = None
    curriculum_id: str
    allocated_duration: int = 0


class GanttEvent(GanttNode):
    """A lesson-type item inside a module (מופע). Durations are minutes.

    Example:
        >>> ev = curriculum["Math"]["Algebra"]["Intro"]
        >>> ev.allocated_duration, ev.module.title, ev.syllabus.title
    """

    _entity = "events"
    _repr_fields = ("id", "title", "type", "minimum_duration")

    type: Annotated[ModuleEventType | str, _ENUM_FIRST] | None = None
    minimum_duration: int = 0
    orchestrator_id: int | None = None
    recommended_lecturer_ids: list[str] = Field(default_factory=list)
    system_requirements: list[str] = Field(default_factory=list)
    room_requirement: Annotated[RoomRequirement | str, _ENUM_FIRST] | None = None
    recurrence: Annotated[EventRecurrence | str, _ENUM_FIRST] = EventRecurrence.NONE
    recurrence_start_date: LenientDate | None = None
    recurrence_end_date: LenientDate | None = None
    is_critical: bool = False
    is_pa_window: bool = False
    split_across_breaks: bool = False
    split_across_weeks: bool = False
    comment: str | None = None
    constraints: list[dict[str, Any]] = Field(default_factory=list)
    shuffles: list[str] = Field(default_factory=list)
    course_ids: list[str] = Field(default_factory=list)
    group_id: str | None = None
    hive_subject_id: int | None = None
    hive_module_id: int | None = None
    hive_lesson_id: int | None = None
    module_id: str | None = None
    allocations: list[EventCurriculumAllocation] = Field(
        default_factory=list, alias="cEC"
    )

    @property
    def module(self) -> Module:
        """The module this event belongs to."""
        if isinstance(self._parent, Module):
            return self._parent
        if not self.module_id:
            raise NotFoundError(f"Event {self.id} has no parent module")
        return self.bluz.gantt.modules.get(self.module_id)

    @property
    def syllabus(self) -> Syllabus:
        return self.module.syllabus

    @property
    def curriculum(self) -> Curriculum | None:
        """The curriculum this event was reached through, if any."""
        return self.module.curriculum

    @property
    def allocated_duration(self) -> int | None:
        """Allocated minutes in the curriculum this event was reached through
        (or in its only curriculum). None when ambiguous or unallocated."""
        curriculum = self.curriculum if self._parent is not None else None
        if curriculum is not None:
            return self.allocated_in(curriculum)
        if len(self.allocations) == 1:
            return self.allocations[0].allocated_duration
        return None

    def allocated_in(self, curriculum: Curriculum | str) -> int | None:
        """Allocated minutes in a given curriculum."""
        target = curriculum if isinstance(curriculum, str) else curriculum.id
        for allocation in self.allocations:
            if allocation.curriculum_id == target:
                return allocation.allocated_duration
        return None

    def set_allocated_duration(
        self, minutes: int, curriculum: Curriculum | str | None = None
    ) -> None:
        """Set allocated minutes in a curriculum (default: the one reached through)."""
        target = curriculum or self.curriculum
        if target is None:
            raise NotFoundError("Pass the curriculum to allocate time in.")
        self.bluz.gantt.events.set_time(self.id, target, minutes)

    def duplicate(self, module: Module | str | None = None) -> GanttEvent:
        """Clone this event into `module` (default: its own module)."""
        return self.bluz.gantt.events.duplicate(self.id, module or self.module)

    def set_shuffle_group(self, shuffles: list[str]) -> Any:
        """Split this event into one sibling per shuffle name (fewer than two ungroups)."""
        return self.bluz.gantt.events.set_shuffle_group(self.id, self.module, shuffles)


# --- modules ----------------------------------------------------------------


class _ModuleEventLink(BluzModel):
    event_id: str | None = None
    event: GanttEvent


class Module(_Container[GanttEvent]):
    """A group of events inside a syllabus (מערך). Iterate it for its events.

    Example:
        >>> for ev in module: print(ev.title, ev.minimum_duration)
        >>> module.create_event("Quiz", type=ModuleEventType.EXERCISE, minimum_duration=45)
    """

    _entity = "modules"

    description: str = ""
    hive_ids: list[int] = Field(default_factory=list)
    constraints: list[dict[str, Any]] = Field(default_factory=list)
    shuffles: list[str] = Field(default_factory=list)
    default_orchestrator_id: int | None = None
    syllabus_id: str | None = None
    links: list[_ModuleEventLink] | None = Field(default=None, alias="m2e")
    # The flat (get-many) shape: just event ids.
    event_ids: list[str] | None = Field(default=None, alias="events")

    def model_post_init(self, context: Any, /) -> None:
        if self.links:
            _bind_parent([link.event for link in self.links], self)

    def _tree_loaded(self) -> bool:
        return self.links is not None

    def _children(self) -> Collection[GanttEvent]:
        if self.links is None:
            full = self.refresh()
            self.links = full.links or []
            _bind_parent([link.event for link in self.links], self)
        return Collection(link.event for link in self.links)

    @property
    def events(self) -> Collection[GanttEvent]:
        """This module's events, in order."""
        return self._children()

    @property
    def syllabus(self) -> Syllabus:
        if isinstance(self._parent, Syllabus):
            return self._parent
        if not self.syllabus_id:
            raise NotFoundError(f"Module {self.id} has no parent syllabus")
        return self.bluz.gantt.syllabuses.get(self.syllabus_id)

    @property
    def curriculum(self) -> Curriculum | None:
        return self.syllabus.curriculum

    def create_event(
        self,
        title: str,
        *,
        type: Annotated[ModuleEventType | str, _ENUM_FIRST] = ModuleEventType.LECTURE,
        minimum_duration: int = 0,
        **fields: Any,
    ) -> GanttEvent:
        """Create an event in this module."""
        return self.bluz.gantt.events.create(
            module_id=self.id,
            title=title,
            type=type,
            minimum_duration=minimum_duration,
            **fields,
        )

    def reorder(self, events: list[GanttEvent | str]) -> None:
        """Set the order of this module's events."""
        self.bluz.gantt.modules.reorder(self.id, events)


# --- syllabuses -------------------------------------------------------------


class _SyllabusModuleLink(BluzModel):
    module_id: str | None = None
    module: Module


class Syllabus(_Container[Module]):
    """A subject's plan inside a curriculum (סילבוס). Iterate it for modules.

    Example:
        >>> syl = curriculum["Mathematics"]
        >>> syl.shuffles, [c.name for c in syl.courses]
        >>> for module in syl: ...
    """

    _entity = "syllabuses"

    description: str | None = None
    hive_ids: list[int] = Field(default_factory=list)
    shuffles: list[str] = Field(default_factory=list)
    shuffle_descriptions: dict[str, str] = Field(default_factory=dict)
    shuffle_hive_groups: dict[str, int] = Field(default_factory=dict)
    course_ids: list[str] = Field(default_factory=list)
    lead_instructor_ids: list[int] = Field(default_factory=list)
    color: str | None = None
    curriculum_ids: list[str] = Field(default_factory=list)
    links: list[_SyllabusModuleLink] | None = Field(default=None, alias="s2m")
    module_ids: list[str] | None = Field(default=None, alias="modules")

    def model_post_init(self, context: Any, /) -> None:
        if self.links:
            _bind_parent([link.module for link in self.links], self)

    def _tree_loaded(self) -> bool:
        return self.links is not None

    def _children(self) -> Collection[Module]:
        if self.links is None:
            full = self.refresh()
            self.links = full.links or []
            _bind_parent([link.module for link in self.links], self)
        return Collection(link.module for link in self.links)

    @property
    def modules(self) -> Collection[Module]:
        return self._children()

    @property
    def events(self) -> Collection[GanttEvent]:
        """Every event of every module, flattened in order."""
        return Collection(event for module in self for event in module)

    @property
    def curriculum(self) -> Curriculum | None:
        """The curriculum this was reached through (or its only one)."""
        if isinstance(self._parent, Curriculum):
            return self._parent
        if len(self.curriculum_ids) == 1:
            return self.bluz.gantt.curriculums.get(self.curriculum_ids[0])
        return None

    @property
    def courses(self) -> Collection[Course]:
        """Course objects this syllabus is linked to."""
        wanted = set(self.course_ids)
        return Collection(c for c in self.bluz.courses.list() if c.id in wanted)

    def create_module(self, title: str, **fields: Any) -> Module:
        """Create a module in this syllabus."""
        fields.setdefault("description", "")
        fields.setdefault("hive_ids", [])
        fields.setdefault("default_orchestrator_id", None)
        return self.bluz.gantt.modules.create(
            syllabus_id=self.id, title=title, **fields
        )

    def shuffle_usages(self, *names: str) -> ShuffleUsages:
        """Modules/events using these shuffle names — what removing them would strip."""
        return self.bluz.gantt.syllabuses.shuffle_usages(self.id, list(names))

    def set_shuffles(
        self, names: list[str], descriptions: dict[str, str] | None = None
    ) -> Any:
        """Replace the shuffle list (cascades removals onto modules/events)."""
        return self.bluz.gantt.syllabuses.set_shuffles(self.id, names, descriptions)

    def set_links(
        self,
        *,
        courses: list[Course | str] | None = None,
        lead_instructor_ids: list[int] | None = None,
    ) -> Syllabus:
        return self.bluz.gantt.syllabuses.set_links(
            self.id, courses=courses, lead_instructor_ids=lead_instructor_ids
        )

    def reorder(self, modules: list[Module | str]) -> None:
        self.bluz.gantt.syllabuses.reorder(self.id, modules)


# --- weeks & days -----------------------------------------------------------


class Day(GanttNode):
    """One working day of a curriculum week."""

    _entity = "days"
    _repr_fields = ("id", "day_index", "total_working_minutes")

    week_id: str | None = None
    day_index: Annotated[GanttDayIndex | int, _ENUM_FIRST] = 0
    total_working_minutes: int = 0
    day_end_time: HHMM | None = None
    comment: str | None = None

    @property
    def week(self) -> Week:
        if isinstance(self._parent, Week):
            return self._parent
        if not self.week_id:
            raise NotFoundError(f"Day {self.id} has no parent week")
        return self.bluz.gantt.weeks.get(self.week_id)


class _WeekDayLink(BluzModel):
    day_id: str | None = None
    day: Day


class Week(_Container[Day]):
    """A curriculum week. Iterate it for its days (Sunday first)."""

    _entity = "weeks"
    _repr_fields = ("id", "number", "weekend_duty")

    number: int = 0
    comment: str | None = None
    weekend_duty: bool = False
    curriculum_id: str | None = None
    links: list[_WeekDayLink] | None = Field(default=None, alias="w2d")
    day_ids: list[str] | None = Field(default=None, alias="days")

    def model_post_init(self, context: Any, /) -> None:
        if self.links:
            self.links.sort(key=lambda link: int(link.day.day_index))
            _bind_parent([link.day for link in self.links], self)

    def _tree_loaded(self) -> bool:
        return self.links is not None

    def _children(self) -> Collection[Day]:
        if self.links is None:
            full = self.refresh()
            self.links = full.links or []
            _bind_parent([link.day for link in self.links], self)
        return Collection(link.day for link in self.links)

    @property
    def days(self) -> Collection[Day]:
        return self._children()

    def day(self, index: Annotated[GanttDayIndex | int, _ENUM_FIRST]) -> Day:
        """The day with this weekday index (0 = Sunday)."""
        for day in self.days:
            if int(day.day_index) == int(index):
                return day
        raise NotFoundError(f"Week {self.number} has no day {index}")


# --- curriculum -------------------------------------------------------------


class _CurriculumSyllabusLink(BluzModel):
    syllabus_id: str | None = None
    syllabus: Syllabus


class _CurriculumWeekLink(BluzModel):
    week_id: str | None = None
    week: Week


class DayMapping(BluzModel):
    """A module (or one of its events) placed on a curriculum day (cMDA)."""

    _repr_fields = ("module_id", "event_id", "day_id", "sort_order")

    module_id: str
    event_id: str | None = None
    day_id: str
    curriculum_id: str | None = None
    sort_order: float = 0
    week_split_minutes: list[int] | None = None


class RecurrenceException(BluzModel):
    """One skipped (or materialized) occurrence of a recurring event."""

    _repr_fields = ("event_id", "day_id", "materialized_event_id")

    id: str
    curriculum_id: str
    event_id: str
    day_id: str
    materialized_event_id: str | None = None


class Curriculum(_Container[Syllabus]):
    """A full course plan. Iterate it for syllabuses; `.weeks` for the timeline.

    A single `bz.gantt.curriculums.get(id)` fetches the entire tree, so
    walking it costs no further requests.

    Example:
        >>> cur = bz.gantt.curriculums["Bis90 2026"]
        >>> for syl in cur:
        ...     for module in syl:
        ...         for ev in module:
        ...             print(syl.title, module.title, ev.title, ev.allocated_duration)
        >>> cur["Mathematics"]["Algebra"]          # lookup by title
        >>> plan = cur.cut_plan(); plan.report     # dry-run the schedule cut
    """

    _entity = "curriculums"
    _repr_fields = ("id", "title", "is_draft")

    description: str = ""
    start_date: LenientDate | None = None
    is_draft: bool = True
    is_archived: bool = False
    syllabus_links: list[_CurriculumSyllabusLink] | None = Field(
        default=None, alias="c2s"
    )
    week_links: list[_CurriculumWeekLink] | None = Field(default=None, alias="c2w")
    syllabus_ids: list[str] | None = Field(default=None, alias="syllabuses")
    week_ids: list[str] | None = Field(default=None, alias="weeks")

    def model_post_init(self, context: Any, /) -> None:
        if self.syllabus_links:
            _bind_parent([link.syllabus for link in self.syllabus_links], self)
        if self.week_links:
            self.week_links.sort(key=lambda link: link.week.number)
            _bind_parent([link.week for link in self.week_links], self)

    def _tree_loaded(self) -> bool:
        return self.syllabus_links is not None

    def _load(self) -> None:
        full = self.refresh()
        self.syllabus_links = full.syllabus_links or []
        self.week_links = full.week_links or []
        self.model_post_init(None)

    def _children(self) -> Collection[Syllabus]:
        if self.syllabus_links is None:
            self._load()
        return Collection(link.syllabus for link in self.syllabus_links or [])

    @property
    def syllabuses(self) -> Collection[Syllabus]:
        return self._children()

    @property
    def weeks(self) -> Collection[Week]:
        """Timeline weeks, by number."""
        if self.week_links is None:
            self._load()
        return Collection(link.week for link in self.week_links or [])

    @property
    def days(self) -> Collection[Day]:
        """Every day of every week, in order."""
        return Collection(day for week in self.weeks for day in week)

    @property
    def modules(self) -> Collection[Module]:
        """Every module of every syllabus, flattened."""
        return Collection(module for syllabus in self for module in syllabus)

    @property
    def events(self) -> Collection[GanttEvent]:
        """Every Gantt event of every module, flattened."""
        return Collection(event for module in self.modules for event in module)

    def week(self, number: int) -> Week:
        for week in self.weeks:
            if week.number == number:
                return week
        raise NotFoundError(f"Curriculum {self.title!r} has no week {number}")

    # --- authoring ------------------------------------------------------------

    def create_syllabus(self, title: str, **fields: Any) -> Syllabus:
        fields.setdefault("hive_ids", [])
        return self.bluz.gantt.syllabuses.create(
            curriculum_id=self.id, title=title, **fields
        )

    def duplicate(self, **overrides: Any) -> Curriculum:
        """Deep-clone this curriculum. Keyword args override the copy's fields."""
        return self.bluz.gantt.curriculums.duplicate(self.id, **overrides)

    def export(self) -> dict[str, Any]:
        """The portable JSON export (curriculum + mappings + constraints)."""
        return self.bluz.gantt.curriculums.export(self.id)

    def export_excel(self) -> bytes:
        return self.bluz.gantt.curriculums.export_excel(self.id)

    # --- placement ------------------------------------------------------------

    def mappings(self) -> Collection[DayMapping]:
        return self.bluz.gantt.curriculums.mappings(self.id)

    def constraints(self) -> Any:
        return self.bluz.gantt.curriculums.constraints(self.id)

    def recurrence_exceptions(self) -> Collection[RecurrenceException]:
        return self.bluz.gantt.curriculums.recurrence_exceptions(self.id)

    # --- cut pipeline -----------------------------------------------------------

    def cut_status(self) -> CutStatus:
        return self.bluz.gantt.curriculums.cut_status(self.id)

    def cut_preview(self) -> Any:
        return self.bluz.gantt.curriculums.cut_preview(self.id)

    def cut_plan(self, **options: Any) -> CutPlan:
        """Plan the cut without writing. See `CurriculumsAPI.cut_plan`."""
        return self.bluz.gantt.curriculums.cut_plan(self.id, **options)

    def cut(self, **options: Any) -> CutResult:
        """Materialize into calendar events. See `CurriculumsAPI.cut`."""
        return self.bluz.gantt.curriculums.cut(self.id, **options)

    def pull_back(self) -> Any:
        return self.bluz.gantt.curriculums.pull_back(self.id)

    def execution(self) -> CurriculumExecution:
        """Planned vs. actual (תכנון מול ביצוע)."""
        return self.bluz.gantt.curriculums.execution(self.id)
