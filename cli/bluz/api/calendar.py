"""
Name: calendar.py
Purpose: `bz.events`, `bz.drafts`, `bz.snapshots` — the schedule itself, its
         change log, shared drafts, restore points and the ICS export.
         Mirrors ui/src/api-client/{calendar,calendar-drafts,
         calendar-snapshots}.ts.
Created: 2026-10-02
Author: Michael K. Steinberg
"""

from __future__ import annotations

from collections.abc import Iterable, Mapping
from datetime import date, datetime
from typing import TYPE_CHECKING, Any

from bluz.api._base import Resource, iso, ref
from bluz.errors import BluzApiError
from bluz.models._base import BluzModel, Collection, camel_payload, to_wire
from bluz.models.calendar import (
    CalendarDraft,
    CalendarSnapshot,
    Event,
    EventHistoryEntry,
    SnapshotRestoreResult,
)

if TYPE_CHECKING:
    from bluz.models.iterations import Iteration

__all__ = ["DraftsAPI", "EventsAPI", "SnapshotsAPI"]

_BASE = "/api/event"
_DRAFTS = "/api/calendar/drafts"
_SNAPSHOTS = "/api/calendar/snapshots"

DateLike = datetime | date | str


def _event_payload(event: Event | Mapping[str, Any], fields: dict[str, Any]) -> Any:
    return camel_payload(event, **fields)


class EventsAPI(Resource):
    """`bz.events` — calendar events.

    Examples:
        >>> week = bz.events.list("2026-11-01", "2026-11-08")
        >>> lectures = week.where(type=EventType.LECTURE)
        >>> bz.events.export_ics("2026-11-01", "2026-12-01")[:100]
    """

    def list(
        self,
        start: DateLike,
        end: DateLike,
        *,
        iteration: str | Iteration | None = None,
    ) -> Collection[Event]:
        """Events in `[start, end)`. Dates may be `date`, `datetime` or ISO strings."""
        params = {"sd": iso(start), "ed": iso(end), "it": self._it(iteration)}
        return self._many(Event, self._http.get(_BASE, params=params))

    def get(
        self,
        *ids: str,
        iteration: str | Iteration | None = None,
    ) -> Collection[Event]:
        """Events by id: `bz.events.get("a", "b")`."""
        params = {"ids": ",".join(ids), "it": self._it(iteration)}
        return self._many(Event, self._http.get(_BASE, params=params))

    def create(
        self, event: Event | Mapping[str, Any] | None = None, /, **fields: Any
    ) -> Event:
        """Create an event from a model, a wire dict and/or snake_case fields."""
        return self._one(
            Event, self._http.put(_BASE, json=_event_payload(event or {}, fields))
        )

    def update(
        self, event: Event | Mapping[str, Any] | None = None, /, **fields: Any
    ) -> Event:
        """Replace an event (the payload must include `id`)."""
        return self._one(
            Event, self._http.post(_BASE, json=_event_payload(event or {}, fields))
        )

    def delete(self, event: Event | str) -> None:
        """Delete (archive) an event by id or object."""
        self._http.delete(_BASE, json=ref(event))

    def compare(
        self,
        start: DateLike,
        end: DateLike,
        iteration_a: str | Iteration | None = None,
        iteration_b: str | Iteration | None = None,
    ) -> Any:
        """Diff the events of two iterations over the same range."""
        params = {
            "sd": iso(start),
            "ed": iso(end),
            "itA": ref(iteration_a),
            "itB": ref(iteration_b),
        }
        return self._http.get(f"{_BASE}/compare", params=params)

    def history(self, event: Event | str) -> Collection[EventHistoryEntry]:
        """Change log for one event, newest first."""
        return self._many(
            EventHistoryEntry,
            self._http.get(f"{_BASE}/history", params={"id": ref(event)}),
        )

    def export_ics(
        self,
        start: DateLike,
        end: DateLike,
        *,
        iteration: str | Iteration | None = None,
    ) -> bytes:
        """The schedule in a range (max 366 days) as an ICS calendar."""
        data = self._http.get(
            "/api/event/export/ics",
            params={"sd": iso(start), "ed": iso(end), "it": self._it(iteration)},
        )
        if isinstance(data, str):
            data = data.encode("utf-8")
        if not isinstance(data, bytes):
            raise BluzApiError(
                "InvalidResponse",
                f"Expected an ICS payload, got {type(data).__name__}: {str(data)[:200]}",
            )
        return data


def _events_body(events: Iterable[Event | Mapping[str, Any]] | None) -> Any:
    if events is None:
        return None
    return [
        to_wire(event) if isinstance(event, BluzModel) else event for event in events
    ]


class DraftsAPI(Resource):
    """`bz.drafts` — named, shared, editable working copies of the calendar."""

    def list(
        self, *, iteration: str | Iteration | None = None
    ) -> Collection[CalendarDraft]:
        """Draft summaries, newest-updated first (no events — see `get`)."""
        return self._many(
            CalendarDraft, self._http.get(_DRAFTS, params={"it": self._it(iteration)})
        )

    def get(
        self, draft: CalendarDraft | str, *, iteration: str | Iteration | None = None
    ) -> CalendarDraft:
        """One draft including its events."""
        params = {"id": ref(draft), "it": self._it(iteration)}
        return self._one(CalendarDraft, self._http.get(_DRAFTS, params=params))

    def create(
        self,
        label: str,
        events: Iterable[Event | Mapping[str, Any]] = (),
        *,
        iteration: str | Iteration | None = None,
    ) -> CalendarDraft:
        """Create a shared draft holding `events` (models or wire dicts)."""
        body = {"label": label, "events": _events_body(events) or []}
        return self._one(
            CalendarDraft,
            self._http.post(_DRAFTS, json=body, params={"it": self._it(iteration)}),
        )

    def update(
        self,
        draft: CalendarDraft | str,
        *,
        label: str | None = None,
        events: Iterable[Event | Mapping[str, Any]] | None = None,
        iteration: str | Iteration | None = None,
    ) -> CalendarDraft:
        """Relabel and/or replace the events. Omitted arguments are left alone."""
        body = camel_payload(id=ref(draft), label=label, events=_events_body(events))
        return self._one(
            CalendarDraft,
            self._http.put(_DRAFTS, json=body, params={"it": self._it(iteration)}),
        )

    def delete(
        self, draft: CalendarDraft | str, *, iteration: str | Iteration | None = None
    ) -> None:
        """Delete a shared draft."""
        self._http.delete(_DRAFTS, params={"id": ref(draft), "it": self._it(iteration)})


class SnapshotsAPI(Resource):
    """`bz.snapshots` — immutable restore points of the calendar."""

    def list(
        self, *, iteration: str | Iteration | None = None
    ) -> Collection[CalendarSnapshot]:
        """Snapshot summaries, newest first (no events — see `get`)."""
        return self._many(
            CalendarSnapshot,
            self._http.get(_SNAPSHOTS, params={"it": self._it(iteration)}),
        )

    def get(
        self,
        snapshot: CalendarSnapshot | str,
        *,
        iteration: str | Iteration | None = None,
    ) -> CalendarSnapshot:
        """One snapshot including its captured events."""
        params = {"id": ref(snapshot), "it": self._it(iteration)}
        return self._one(CalendarSnapshot, self._http.get(_SNAPSHOTS, params=params))

    def create(
        self,
        label: str,
        events: Iterable[Event | Mapping[str, Any]] = (),
        *,
        iteration: str | Iteration | None = None,
    ) -> CalendarSnapshot:
        """Capture a restore point from `events` (models or wire dicts)."""
        body = {"label": label, "events": _events_body(events) or []}
        return self._one(
            CalendarSnapshot,
            self._http.post(_SNAPSHOTS, json=body, params={"it": self._it(iteration)}),
        )

    def delete(
        self,
        snapshot: CalendarSnapshot | str,
        *,
        iteration: str | Iteration | None = None,
    ) -> None:
        """Delete a snapshot (the live calendar is not touched)."""
        self._http.delete(
            _SNAPSHOTS, params={"id": ref(snapshot), "it": self._it(iteration)}
        )

    def restore(
        self,
        snapshot: CalendarSnapshot | str,
        *,
        iteration: str | Iteration | None = None,
    ) -> SnapshotRestoreResult:
        """Restore the calendar to a snapshot (archives live events in its range)."""
        return self._one(
            SnapshotRestoreResult,
            self._http.post(
                f"{_SNAPSHOTS}/restore",
                params={"id": ref(snapshot), "it": self._it(iteration)},
            ),
        )
