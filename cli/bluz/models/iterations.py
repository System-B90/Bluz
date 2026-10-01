"""
Name: iterations.py
Purpose: Course iteration (bi-annual run, "Luz") models. Mirrors
         ui/src/api-shared/types/iteration.ts.
Created: 2026-10-02
Author: Michael K. Steinberg
"""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, Any

from pydantic import Field

from bluz.models._base import BluzModel, Collection

if TYPE_CHECKING:
    from bluz.models.calendar import Event
    from bluz.models.gantt import Curriculum
    from bluz.sdk import Bluz

__all__ = [
    "HiveCacheChanges",
    "HiveIterationCache",
    "Iteration",
    "IterationUsage",
    "SyncHiveResult",
]


class HiveIterationCache(BluzModel):
    """Hive names snapshotted when the iteration was registered (ids → names)."""

    _repr_fields = ("cached_at",)

    modules: dict[str, str] = Field(default_factory=dict)
    subjects: dict[str, str] = Field(default_factory=dict)
    rooms: dict[str, str] = Field(default_factory=dict)
    cached_at: datetime | None = None


class Iteration(BluzModel):
    """One course run. Each iteration has its own calendar database.

    Exactly one iteration is current — the writable one. Past iterations are
    read-only history.

    Example:
        >>> it = bz.iterations.current()
        >>> it.curriculum.title
        >>> old = bz.scoped(bz.iterations["2026a"])   # a session reading 2026a
    """

    _repr_fields = ("id", "label", "is_current")

    id: str
    label: str = ""
    db_name: str | None = None
    hive_url: str | None = None
    hive_cache: HiveIterationCache | None = None
    start_date: datetime | None = None
    end_date: datetime | None = None
    is_current: bool = False
    gantt_curriculum_id: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None

    @property
    def curriculum(self) -> Curriculum | None:
        """The Gantt curriculum this iteration was cut from, if linked."""
        if not self.gantt_curriculum_id:
            return None
        return self.bluz.gantt.curriculums.get(self.gantt_curriculum_id)

    def scoped(self) -> Bluz:
        """A session whose iteration-aware calls default to this iteration."""
        return self.bluz.scoped(self)

    def events(self, start: datetime | str, end: datetime | str) -> Collection[Event]:
        """Calendar events of this iteration in a date range."""
        return self.bluz.events.list(start, end, iteration=self)

    def usage(self) -> IterationUsage:
        return self.bluz.iterations.usage(self)

    def set_current(self) -> Iteration:
        return self.bluz.iterations.set_current(self)

    def update(self, **fields: Any) -> Iteration:
        return self.bluz.iterations.patch(self, **fields)

    def sync_hive(self) -> SyncHiveResult:
        return self.bluz.iterations.sync_hive(self)

    def delete(self) -> None:
        self.bluz.iterations.delete(self)


class IterationUsage(BluzModel):
    """What still hangs off an iteration — only an orphaned one is deletable."""

    _repr_fields = ("curriculums", "events", "is_current", "orphaned")

    curriculums: int = 0
    events: int = 0
    is_current: bool = False
    orphaned: bool = False


class HiveCacheChanges(BluzModel):
    _repr_fields = ("added", "updated", "removed", "unchanged")

    added: int = 0
    updated: int = 0
    removed: int = 0
    unchanged: int = 0


class SyncHiveResult(BluzModel):
    _repr_fields = ("iteration", "changes")

    iteration: Iteration
    changes: HiveCacheChanges
