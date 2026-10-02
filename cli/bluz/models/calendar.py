"""
Name: calendar.py
Purpose: Calendar (schedule) models — events, their change history, shared
         drafts and snapshots. Mirrors ui/src/api-shared/types/event.ts,
         event-history.ts and the draft/snapshot types in api-shared/types.ts.
Created: 2026-10-02
Author: Michael K. Steinberg
"""

from __future__ import annotations

from datetime import datetime, timedelta
from enum import StrEnum
from typing import TYPE_CHECKING, Annotated, Any

from pydantic import Field

from bluz.models._base import ENUM_FIRST as _ENUM_FIRST
from bluz.models._base import BluzModel, Collection, EpochMs, LenientDate
from bluz.models.directory import RoomRef

if TYPE_CHECKING:
    from bluz.models.directory import Course
    from bluz.models.gantt import Curriculum, GanttEvent

__all__ = [
    "CalendarDraft",
    "CalendarSnapshot",
    "Event",
    "EventFieldChange",
    "EventHistoryEntry",
    "EventType",
    "SnapshotRestoreResult",
]


class EventType(StrEnum):
    """Calendar event kinds. Values are the Hebrew labels the server stores."""

    EXERCISE = 'ע"ע'
    LECTURE = "הרצאה"
    WORKSHOP = "סדנה"
    SELF_TEACHING = 'ל"ע'
    BREAK = "הפסקה"
    PRAYER = "תפילה"
    OTHER = "אחר"


class Event(BluzModel):
    """One scheduled calendar event.

    `start_time`/`end_time` are timezone-aware datetimes; `courses` holds
    course ids (shuffles), `rooms` holds `{id, source}` room refs.

    Examples:
        >>> ev = bz.events.list("2026-11-01", "2026-11-02")[0]
        >>> ev.duration, ev.course_objects, ev.history()
        >>> ev.notes = "moved"; ev.save()
    """

    _repr_fields = ("id", "name", "start_time", "end_time")

    id: str
    name: str = ""
    subject: int | None = None
    hive_module: int | None = None
    hive_lesson: int | None = None
    hive_queues: dict[str, int] | None = None
    start_time: datetime
    end_time: datetime
    type: Annotated[EventType | str, _ENUM_FIRST] = EventType.OTHER
    courses: list[str] = Field(default_factory=list)
    rooms: list[RoomRef] = Field(default_factory=list)
    instructors: list[int] = Field(default_factory=list)
    lecturers: list[int | str] | None = None
    tags: list[int] = Field(default_factory=list)
    notes: str = ""
    locked: bool = False
    hidden: bool = False
    required: bool = False
    personal_talk: bool = False
    split_across_breaks: bool = False
    color: str | None = None
    fake: bool | None = None
    gantt_event_id: str | None = None
    gantt_occurrence_date: LenientDate | None = None
    gantt_curriculum_id: str | None = None
    updated_at: EpochMs | None = None

    @property
    def duration(self) -> timedelta:
        """`end_time - start_time` as a timedelta."""
        return self.end_time - self.start_time

    @property
    def course_objects(self) -> Collection[Course]:
        """The `Course` objects behind `courses` (one list request)."""
        wanted = set(self.courses)
        return Collection(c for c in self.bluz.courses.list() if c.id in wanted)

    @property
    def gantt_event(self) -> GanttEvent | None:
        """The Gantt event this was cut from, if any."""
        if not self.gantt_event_id:
            return None
        return self.bluz.gantt.events.get(self.gantt_event_id)

    @property
    def curriculum(self) -> Curriculum | None:
        """The curriculum this was cut from, if any."""
        if not self.gantt_curriculum_id:
            return None
        return self.bluz.gantt.curriculums.get(self.gantt_curriculum_id)

    def history(self) -> Collection[EventHistoryEntry]:
        """Change log for this event, newest first."""
        return self.bluz.events.history(self)

    def save(self) -> Event:
        """Write this event's current field values back (full replace)."""
        return self.bluz.events.update(self)

    def delete(self) -> None:
        """Delete (archive) this event."""
        self.bluz.events.delete(self)


class EventFieldChange(BluzModel):
    _repr_fields = ("field", "from_", "to")

    field: str
    from_: Any = Field(default=None, alias="from")
    to: Any = None


class EventHistoryEntry(BluzModel):
    """One write to an event: who, when, via what, and which fields changed."""

    _repr_fields = ("action", "initiator", "actor_name", "changed_at")

    id: str
    event_id: str
    action: str
    initiator: str
    context: dict[str, Any] | None = None
    actor_id: str | None = None
    actor_hive_id: int | None = None
    actor_name: str | None = None
    changed_at: datetime
    changes: list[EventFieldChange] = Field(default_factory=list)


class CalendarDraft(BluzModel):
    """A named, shared, mutable working copy of (part of) the calendar.

    List calls return summaries (`event_count` set, `events` empty); fetch one
    with `bz.drafts.get(id)` for the events.
    """

    _repr_fields = ("id", "label", "updated_by", "event_count")

    id: str
    label: str = ""
    created_at: datetime | None = None
    updated_at: datetime | None = None
    updated_by: str | None = None
    updated_by_id: str | None = None
    iteration_id: str | None = None
    event_count: int | None = None
    events: list[Event] = Field(default_factory=list)

    def load(self) -> CalendarDraft:
        """The full draft, including its events."""
        return self.bluz.drafts.get(self)

    def delete(self) -> None:
        """Delete this draft."""
        self.bluz.drafts.delete(self)


class CalendarSnapshot(BluzModel):
    """An immutable restore point of the calendar.

    List calls return summaries; `bz.snapshots.get(id)` includes the events.
    """

    _repr_fields = ("id", "label", "created_at", "event_count")

    id: str
    label: str = ""
    created_at: datetime | None = None
    iteration_id: str | None = None
    event_count: int | None = None
    events: list[Event] = Field(default_factory=list)

    def load(self) -> CalendarSnapshot:
        """The full snapshot, including its captured events."""
        return self.bluz.snapshots.get(self)

    def restore(self) -> SnapshotRestoreResult:
        """Restore the calendar to this snapshot (archives live events in its range)."""
        return self.bluz.snapshots.restore(self)

    def delete(self) -> None:
        """Delete this snapshot (the live calendar is not touched)."""
        self.bluz.snapshots.delete(self)


class SnapshotRestoreResult(BluzModel):
    _repr_fields = ("restored_count", "removed_count", "range_start", "range_end")

    restored_count: int = 0
    removed_count: int = 0
    range_start: datetime | None = None
    range_end: datetime | None = None
