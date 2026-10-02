"""
Name: platform.py
Purpose: The smaller API namespaces — app settings, personal settings, Google
         Calendar, Hive reference data, the AI assistant, the student board
         and platform probes (health, Hive status, WebSocket ticket).
         Mirrors ui/src/api-client/{settings,personal-settings,
         google-calendar,hive,ai,student-view}.ts.
Created: 2026-10-02
Author: Michael K. Steinberg
"""

from __future__ import annotations

from collections.abc import Iterator, Mapping
from datetime import date
from typing import TYPE_CHECKING, Any, Literal

from bluz.api._base import Resource, iso
from bluz.models._base import BluzModel, camel_payload
from bluz.models.misc import (
    AiCapabilities,
    GoogleCalendarList,
    GoogleCalendarStatus,
    GooglePurgeResult,
    GoogleSyncResult,
    HealthReport,
    HiveActivationTick,
    MealSettings,
    PersonalSettings,
    PrayerSettings,
    ScheduleSettings,
    StudentSchedule,
)

if TYPE_CHECKING:
    from bluz.models.iterations import Iteration

__all__ = [
    "KNOWN_SETTING_KEYS",
    "MEAL_TIMES_SETTING_KEY",
    "PRAYER_TIMES_SETTING_KEY",
    "SCHEDULE_SETTING_KEY",
    "AiAPI",
    "GoogleCalendarAPI",
    "HiveAPI",
    "PersonalSettingsAPI",
    "SettingsAPI",
    "StudentViewAPI",
]

_SETTINGS = "/api/settings"
_PERSONAL = "/api/personal-settings"
_GOOGLE = "/api/integrations/google-calendar"
_HIVE = "/api/hive"
_AI = "/api/ai"
_STUDENT = "/api/student-view"

# Well-known setting keys. Kept in step with api-shared/types/settings/* —
# the server has no enumeration route.
PRAYER_TIMES_SETTING_KEY = "prayerTimes"
MEAL_TIMES_SETTING_KEY = "mealTimes"
SCHEDULE_SETTING_KEY = "schedule"
KNOWN_SETTING_KEYS = [
    PRAYER_TIMES_SETTING_KEY,
    MEAL_TIMES_SETTING_KEY,
    SCHEDULE_SETTING_KEY,
]


def _body(value: Any) -> Any:
    return value.to_wire() if isinstance(value, BluzModel) else value


class SettingsAPI(Resource):
    """`bz.settings` — application-wide keyed settings.

    Examples:
        >>> bz.settings.schedule().day_start_time
        >>> bz.settings.set("mealTimes", {"breakfastTime": "07:15", ...})
    """

    keys = KNOWN_SETTING_KEYS

    def get(self, name: str) -> Any:
        """A setting's raw value."""
        return self._http.get(f"{_SETTINGS}/{name}")

    def set(self, name: str, value: Any) -> None:
        """Write a setting (a model or plain JSON)."""
        self._http.post(f"{_SETTINGS}/{name}", json=_body(value))

    def schedule(self) -> ScheduleSettings:
        """Day bounds the cut and the calendar use (`time` values)."""
        return self._one(ScheduleSettings, self.get(SCHEDULE_SETTING_KEY) or {})

    def set_schedule(self, value: ScheduleSettings | Mapping[str, Any]) -> None:
        """Write the schedule settings (a model or a wire dict)."""
        self.set(SCHEDULE_SETTING_KEY, value)

    def meal_times(self) -> MealSettings:
        """Preferred breakfast / lunch / dinner times."""
        return self._one(MealSettings, self.get(MEAL_TIMES_SETTING_KEY) or {})

    def set_meal_times(self, value: MealSettings | Mapping[str, Any]) -> None:
        """Write the meal times (a model or a wire dict)."""
        self.set(MEAL_TIMES_SETTING_KEY, value)

    def prayer_times(self) -> PrayerSettings:
        """Shacharit / mincha / arvit times."""
        return self._one(PrayerSettings, self.get(PRAYER_TIMES_SETTING_KEY) or {})

    def set_prayer_times(self, value: PrayerSettings | Mapping[str, Any]) -> None:
        """Write the prayer times (a model or a wire dict)."""
        self.set(PRAYER_TIMES_SETTING_KEY, value)


class PersonalSettingsAPI(Resource):
    """`bz.personal` — the signed-in user's own preferences."""

    def get(self) -> PersonalSettings:
        """The signed-in user's own settings."""
        return self._one(PersonalSettings, self._http.get(_PERSONAL) or {})

    def replace(
        self, settings: PersonalSettings | Mapping[str, Any]
    ) -> PersonalSettings:
        """Write the whole document verbatim."""
        return self._one(
            PersonalSettings, self._http.post(_PERSONAL, json=_body(settings))
        )

    def update(self, **fields: Any) -> PersonalSettings:
        """Change some fields; the rest are read first and carried over
        (the endpoint replaces the whole document)."""
        current = self._http.get(_PERSONAL) or {}
        return self.replace({**current, **camel_payload(**fields)})


class GoogleCalendarAPI(Resource):
    """`bz.google` — the per-user Google Calendar mirror."""

    def status(self) -> GoogleCalendarStatus:
        """Whether Google Calendar is configured on the server and linked for you."""
        return self._one(GoogleCalendarStatus, self._http.get(f"{_GOOGLE}/status"))

    def connect(self, code: str) -> None:
        """Exchange an authorization code (from the web UI's GIS popup) for tokens."""
        self._http.post(f"{_GOOGLE}/connect", json={"code": code})

    def disconnect(self) -> None:
        """Revoke your stored Google tokens."""
        self._http.post(f"{_GOOGLE}/disconnect")

    def sync(self) -> GoogleSyncResult:
        """Manual two-way sync over the next 90 days."""
        return self._one(GoogleSyncResult, self._http.post(f"{_GOOGLE}/sync") or {})

    def calendars(self) -> GoogleCalendarList:
        """Calendars you can mirror into, and which one is selected."""
        return self._one(GoogleCalendarList, self._http.get(f"{_GOOGLE}/calendars"))

    def select_calendar(
        self, calendar_id: str | None = None, *, create_new: bool = False
    ) -> Any:
        """Point the link at another calendar — exactly one of `calendar_id` / `create_new`."""
        if bool(calendar_id) == create_new:
            raise ValueError("Pass exactly one of calendar_id or create_new=True.")
        payload: dict[str, Any] = (
            {"createNew": True} if create_new else {"calendarId": calendar_id}
        )
        return self._http.post(f"{_GOOGLE}/calendars", json=payload)

    def purge(
        self, scope: Literal["orphaned", "all"] = "orphaned"
    ) -> GooglePurgeResult:
        """Remove Bluz-created events from the linked Google calendar."""
        if scope not in ("orphaned", "all"):
            raise ValueError("scope must be 'orphaned' or 'all'.")
        return self._one(
            GooglePurgeResult,
            self._http.post(f"{_GOOGLE}/purge", json={"scope": scope}) or {},
        )


class HiveAPI(Resource):
    """`bz.hive` — Hive LMS reference data, proxied read-only through Bluz.

    Results are plain dicts (Hive's own schema). For a typed Hive client, use
    PyHive directly.
    """

    def _list(
        self, name: str, params: dict[str, Any] | None = None
    ) -> list[dict[str, Any]]:
        return self._http.get(f"{_HIVE}/{name}", params=params) or []

    def users(self) -> list[dict[str, Any]]:
        """Hive staff users."""
        return self._list("users")

    def students(self) -> list[dict[str, Any]]:
        """Hive students."""
        return self._list("students")

    def classes(self) -> list[dict[str, Any]]:
        """Hive classes (student groups — Bluz shuffles map onto these)."""
        return self._list("classes")

    def subjects(self) -> list[dict[str, Any]]:
        """Hive subjects."""
        return self._list("subjects")

    def modules(self) -> list[dict[str, Any]]:
        """Hive modules."""
        return self._list("modules")

    def rooms(self) -> list[dict[str, Any]]:
        """Hive rooms."""
        return self._list("rooms")

    def lessons(
        self,
        *,
        module_id: int | str | None = None,
        program_ids: list[int] | str | None = None,
    ) -> list[dict[str, Any]]:
        """Hive lessons, optionally by module or parent program ids."""
        if isinstance(program_ids, list):
            program_ids = ",".join(str(pid) for pid in program_ids)
        return self._list(
            "lessons",
            {
                "module__id": module_id,
                "module__parent_subject__parent_program_id__in": program_ids,
            },
        )

    def queues(self, module_id: int) -> list[dict[str, Any]]:
        """Queues of one Hive module (module-scoped by design)."""
        return self._list("queues", {"module": module_id})

    def activate_lessons(self) -> HiveActivationTick:
        """Run one lesson-activation pass now (idempotent)."""
        return self._one(
            HiveActivationTick, self._http.post(f"{_HIVE}/lesson-activation")
        )

    def avatar(self, user_id: int | str) -> bytes | None:
        """A Hive user's avatar image bytes, or None when they have none."""
        data = self._http.get(f"{_HIVE}/users/avatars/{user_id}")
        return data if isinstance(data, bytes) else None


class AiAPI(Resource):
    """`bz.ai` — the in-app assistant."""

    def tools(self) -> AiCapabilities:
        """What the assistant can do (`enabled: False` when no model key is set)."""
        return self._one(AiCapabilities, self._http.get(f"{_AI}/tools"))

    def models(self) -> Any:
        """Models the configured backend lists (`models` empty, with `error`,
        when it cannot list them)."""
        return self._http.get(f"{_AI}/models")

    def benchmark(self) -> Any:
        """Provider self-test (throttled server-side to once an hour)."""
        return self._http.post(f"{_AI}/benchmark")

    def stream(self, payload: Mapping[str, Any]) -> Iterator[dict[str, Any]]:
        """Raw chat frames for a full request payload (see `chat`)."""
        return self._http.stream_sse(f"{_AI}/chat", json=dict(payload))

    def chat(
        self,
        prompt: str,
        *,
        messages: list[dict[str, Any]] | None = None,
        iteration: str | Iteration | None = None,
        curriculum_id: str | None = None,
        model: str | None = None,
        approved_tool_call_ids: list[str] | None = None,
    ) -> Iterator[dict[str, Any]]:
        """Ask one question; yields stream frames (`delta`, `tool_start`, ..., `done`).

        Write tools stop the turn with `awaitingApproval` on the `done` frame;
        resend with `approved_tool_call_ids` and the transcript to continue.
        """
        payload = {
            "messages": [*(messages or []), {"role": "user", "content": prompt}],
            "iterationId": self._it(iteration),
            "curriculumId": curriculum_id,
            "model": model,
            "approvedToolCallIds": list(approved_tool_call_ids or []),
        }
        return self.stream(
            {key: value for key, value in payload.items() if value not in (None, [])}
        )

    def ask(self, prompt: str, **kwargs: Any) -> str:
        """Convenience: the assistant's full text answer to one question."""
        return "".join(
            frame.get("text", "")
            for frame in self.chat(prompt, **kwargs)
            if frame.get("type") == "delta"
        )


class StudentViewAPI(Resource):
    """`bz.student_view` — the read-only per-day student board."""

    def schedule(
        self,
        day: date | str | None = None,
        *,
        iteration: str | Iteration | None = None,
    ) -> StudentSchedule:
        """One day of the board (staff may preview any day)."""
        return self._one(
            StudentSchedule,
            self._http.get(
                f"{_STUDENT}/schedule",
                params={"date": iso(day), "it": self._it(iteration)},
            ),
        )

    def report_engagement(self, seconds: int) -> None:
        """Add focused seconds to the caller's own daily counter."""
        self._http.post(f"{_STUDENT}/engagement", json={"seconds": seconds})


class SystemAPI(Resource):
    """`bz.system` — platform probes."""

    def health(self) -> HealthReport:
        """`/api/health`. Answers its own shape (not the envelope), 503 when unhealthy."""
        return self._one(HealthReport, self._http.get_raw("/api/health"))

    def hive_status(self) -> Any:
        """Whether the server can reach Hive with the session's credentials."""
        return self._http.get("/api/auth/hive-status")

    def ws_ticket(self) -> Any:
        """A short-lived WebSocket ticket (a bare `{ticket}`, not the envelope)."""
        return self._http.get_raw("/api/ws-ticket")
