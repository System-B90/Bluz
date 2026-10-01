"""
Name: misc.py
Purpose: Smaller response models — settings, Google Calendar, the student
         board, cut-pipeline reports, planned-vs-actual, health. Unknown
         server fields are preserved (see BluzModel), so these stay usable
         when the server grows new fields.
Created: 2026-10-02
Author: Michael K. Steinberg
"""

from __future__ import annotations

from datetime import datetime, time
from typing import Any

from pydantic import Field

from bluz.models._base import HHMM, BluzModel, LenientDate

__all__ = [
    "AiCapabilities",
    "CurriculumExecution",
    "CutPlan",
    "CutResult",
    "CutStatus",
    "GoogleCalendarList",
    "GoogleCalendarOption",
    "GoogleCalendarStatus",
    "GooglePurgeResult",
    "GoogleSyncResult",
    "HealthReport",
    "HiveActivationTick",
    "MealSettings",
    "PersonalSettings",
    "PrayerSettings",
    "ScheduleSettings",
    "ShuffleUsageItem",
    "ShuffleUsages",
    "StudentSchedule",
]


# --- settings ---------------------------------------------------------------


class PersonalSettings(BluzModel):
    """The signed-in user's own preferences."""

    _repr_fields = ("groups", "instructors", "google_calendar_enabled")

    groups: list[str] = Field(default_factory=list)
    instructors: list[str] = Field(default_factory=list)
    favorite_outsiders: list[str] = Field(default_factory=list)
    google_calendar_enabled: bool = False
    google_calendar_sync_all_events: bool = False
    ai_assistant_enabled: bool = True
    ai_api_token: str = ""


class ScheduleSettings(BluzModel):
    """Day bounds used by the cut and the calendar view ("HH:mm")."""

    _repr_fields = (
        "day_start_time",
        "weekend_home_start_time",
        "calendar_day_start_time",
        "calendar_day_end_time",
    )

    day_start_time: HHMM = time(8, 0)
    weekend_home_start_time: HHMM = time(10, 0)
    calendar_day_start_time: HHMM = time(7, 0)
    calendar_day_end_time: HHMM = time(22, 0)


class MealSettings(BluzModel):
    _repr_fields = ("breakfast_time", "lunch_time", "dinner_time")

    breakfast_time: HHMM = time(7, 0)
    lunch_time: HHMM = time(13, 0)
    dinner_time: HHMM = time(19, 0)


class PrayerSettings(BluzModel):
    _repr_fields = ("shacharit", "mincha", "arvit")

    shacharit: datetime | None = None
    mincha: datetime | None = None
    arvit: datetime | None = None


# --- Google Calendar ---------------------------------------------------------


class GoogleCalendarStatus(BluzModel):
    _repr_fields = ("configured", "connected", "enabled")

    configured: bool = False
    connected: bool = False
    enabled: bool = False
    client_id: str = ""
    scopes: list[str] = Field(default_factory=list)
    calendar: dict[str, Any] | None = None


class GoogleCalendarOption(BluzModel):
    _repr_fields = ("id", "summary", "access_role", "primary")

    id: str
    summary: str = ""
    access_role: str | None = None
    primary: bool = False
    shared: bool = False


class GoogleCalendarList(BluzModel):
    _repr_fields = ("selected_id", "calendars")

    calendars: list[GoogleCalendarOption] = Field(default_factory=list)
    selected_id: str | None = None


class GoogleSyncResult(BluzModel):
    _repr_fields = ("pushed", "pulled", "updated")

    pushed: int = 0
    pulled: int = 0
    updated: int = 0


class GooglePurgeResult(BluzModel):
    _repr_fields = ("scanned", "removed", "failed")

    scanned: int = 0
    removed: int = 0
    failed: int = 0


# --- student board -------------------------------------------------------------


class StudentSchedule(BluzModel):
    """One day of the student board (the wire's compact, index-based form)."""

    _repr_fields = ("date", "events")

    date: LenientDate | None = None
    events: list[dict[str, Any]] = Field(default_factory=list)
    course_names: list[str] = Field(default_factory=list)
    course_groups: list[list[int]] = Field(default_factory=list)
    room_names: list[str] = Field(default_factory=list)
    calendar_day_start_time: HHMM | None = None
    calendar_day_end_time: HHMM | None = None


# --- cut pipeline ----------------------------------------------------------------


class CutStatus(BluzModel):
    _repr_fields = ("cut", "count")

    cut: bool = False
    count: int = 0


class CutPlan(BluzModel):
    """`cut_plan()` result. Read `report["decisions"]` before committing a cut."""

    _repr_fields = ("report",)

    report: dict[str, Any] | None = None


class CutResult(BluzModel):
    _repr_fields = ("created_events", "overlaps", "spilled_events", "inserted_breaks")

    created_events: int = 0
    created_courses: list[dict[str, Any]] = Field(default_factory=list)
    overlaps: int = 0
    spilled_events: int = 0
    spills: list[dict[str, Any]] = Field(default_factory=list)
    inserted_breaks: int = 0
    hive_subjects_unavailable: bool = False


class CurriculumExecution(BluzModel):
    """Planned vs. actual per Gantt event id (תכנון מול ביצוע)."""

    _repr_fields = ()

    events: dict[str, dict[str, Any]] = Field(default_factory=dict)

    @property
    def drifted(self) -> dict[str, dict[str, Any]]:
        """Only the events whose cut occurrences drifted from the plan."""
        return {
            key: value for key, value in self.events.items() if value.get("drifted")
        }

    def __repr__(self) -> str:
        return f"CurriculumExecution({len(self.events)} events, {len(self.drifted)} drifted)"


class ShuffleUsageItem(BluzModel):
    _repr_fields = ("id", "title", "shuffles")

    id: str
    title: str = ""
    shuffles: list[str] = Field(default_factory=list)


class ShuffleUsages(BluzModel):
    _repr_fields = ("modules", "events")

    modules: list[ShuffleUsageItem] = Field(default_factory=list)
    events: list[ShuffleUsageItem] = Field(default_factory=list)


# --- platform --------------------------------------------------------------------


class HealthReport(BluzModel):
    """`/api/health`: overall status plus per-dependency checks."""

    _repr_fields = ("status",)

    status: str = "unknown"
    checks: dict[str, Any] = Field(default_factory=dict)

    @property
    def healthy(self) -> bool:
        return self.status == "healthy"


class AiCapabilities(BluzModel):
    _repr_fields = ("enabled",)

    enabled: bool = False


class HiveActivationTick(BluzModel):
    _repr_fields = ("considered_events", "activated", "already_active", "failed")

    considered_events: int = 0
    activated: int = 0
    already_active: int = 0
    failed: int = 0
    errors: list[str] = Field(default_factory=list)
