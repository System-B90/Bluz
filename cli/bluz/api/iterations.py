"""
Name: iterations.py
Purpose: `bz.iterations` — register, inspect and switch course iterations.
         Mirrors ui/src/api-client/iterations.ts.
Created: 2026-10-02
Author: Michael K. Steinberg
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Any

from bluz.api._base import Resource, iso, lookup, ref
from bluz.models._base import Collection, camel_payload
from bluz.models.iterations import Iteration, IterationUsage, SyncHiveResult

__all__ = ["IterationsAPI"]

_BASE = "/api/iterations"


class IterationsAPI(Resource):
    """`bz.iterations` — the registry of course runs.

    Example:
        >>> bz.iterations.current()
        >>> bz.iterations["2026a"].usage()
    """

    def list(self) -> Collection[Iteration]:
        """Every registered iteration."""
        return self._many(Iteration, self._http.get(_BASE))

    def current(self) -> Iteration:
        """The current (active, writable) iteration."""
        return self._one(Iteration, self._http.get(f"{_BASE}/current"))

    def get(self, iteration_id: str) -> Iteration:
        """One iteration by id."""
        return self._one(Iteration, self._http.get(f"{_BASE}/{iteration_id}"))

    def __getitem__(self, key: str) -> Iteration:
        """`bz.iterations["2026a"]` or by label."""
        return lookup(self.list(), key, what="iteration")

    def register(
        self,
        iteration_id: str,
        label: str,
        *,
        db_name: str | None = None,
        hive_url: str | None = None,
        start_date: date | datetime | str | None = None,
        end_date: date | datetime | str | None = None,
        gantt_curriculum_id: str | None = None,
    ) -> Iteration:
        """Register a new iteration (its DB name is derived from the id if omitted)."""
        payload = camel_payload(
            id=iteration_id,
            label=label,
            db_name=db_name,
            hive_url=hive_url,
            start_date=iso(start_date),
            end_date=iso(end_date),
            gantt_curriculum_id=gantt_curriculum_id,
        )
        return self._one(Iteration, self._http.post(_BASE, json=payload))

    def patch(
        self,
        iteration: Iteration | str,
        data: dict[str, Any] | None = None,
        /,
        *,
        label: str | None = None,
        hive_url: str | None = None,
        start_date: date | datetime | str | None = None,
        end_date: date | datetime | str | None = None,
        gantt_curriculum_id: str | None = None,
        is_current: bool | None = None,
    ) -> Iteration:
        """Patch mutable fields. Pass `data={"ganttCurriculumId": None}` to unlink."""
        payload = camel_payload(
            data,
            label=label,
            hive_url=hive_url,
            start_date=iso(start_date),
            end_date=iso(end_date),
            gantt_curriculum_id=gantt_curriculum_id,
            is_current=is_current,
        )
        return self._one(
            Iteration, self._http.patch(f"{_BASE}/{ref(iteration)}", json=payload)
        )

    def set_current(self, iteration: Iteration | str) -> Iteration:
        """Make an iteration the current (writable) one."""
        return self.patch(iteration, is_current=True)

    def delete(self, iteration: Iteration | str) -> None:
        """Delete an iteration. Only an orphaned one (see `usage`) is deletable."""
        self._http.delete(f"{_BASE}/{ref(iteration)}")

    def sync_hive(self, iteration: Iteration | str) -> SyncHiveResult:
        """Re-snapshot the iteration's Hive module/subject/room names."""
        return self._one(
            SyncHiveResult, self._http.post(f"{_BASE}/{ref(iteration)}/sync-hive")
        )

    def usage(self, iteration: Iteration | str | None = None) -> IterationUsage:
        """What still hangs off an iteration (default: the current one)."""
        target = ref(iteration) if iteration is not None else "current"
        return self._one(IterationUsage, self._http.get(f"{_BASE}/{target}/usage"))
