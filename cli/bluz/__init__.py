"""
Name: __init__.py
Purpose: Bluz — script and drive the Bluz scheduling & curriculum server from
         Python, or from the `bluz` command line. Single source of truth for
         the package version.
Created: 2026-06-27
Author: Michael K. Steinberg

Quick start (after `bluz login`, or with BLUZ_URL / BLUZ_TOKEN set):

    >>> from bluz import Bluz
    >>> bz = Bluz()
    >>> bz.iterations.current()
    Iteration(id='2026b', label="מחזור 2026 ב'", is_current=True)
    >>> cur = bz.gantt.curriculums["Bis90 2026"]       # by title or id
    >>> for syllabus in cur:                             # Curriculum → Syllabus
    ...     for module in syllabus:                      # Syllabus → Module
    ...         for event in module:                     # Module → GanttEvent
    ...             print(syllabus.title, module.title, event.title)
    >>> week = bz.events.list("2026-11-01", "2026-11-08")
    >>> week.where(type=EventType.LECTURE)

Where to look:
    bluz.Bluz         — the session; its attributes are every API namespace.
    bluz.models       — every object the API returns (pydantic models).
    bluz.errors       — exceptions; catch `BluzError` for all of them.
    bluz.examples     — runnable example scripts (`python -m bluz.examples`).
    bluz.client       — the low-level HTTP client (`bz.http`) for raw `/api/*` calls.
"""

from bluz.errors import (
    BluzApiError,
    BluzError,
    ConfigError,
    NotAuthenticatedError,
    NotFoundError,
)
from bluz.help import describe
from bluz.models import (
    Collection,
    Course,
    Curriculum,
    Day,
    Event,
    EventType,
    GanttEvent,
    Iteration,
    Module,
    ModuleEventType,
    Room,
    RoomSource,
    Syllabus,
    Week,
)
from bluz.models._base import APP_TIMEZONE, today
from bluz.sdk import Bluz, connect

__version__ = "1.3.3"

__all__ = [
    "APP_TIMEZONE",
    "Bluz",
    "BluzApiError",
    "BluzError",
    "Collection",
    "ConfigError",
    "Course",
    "Curriculum",
    "Day",
    "Event",
    "EventType",
    "GanttEvent",
    "Iteration",
    "Module",
    "ModuleEventType",
    "NotAuthenticatedError",
    "NotFoundError",
    "Room",
    "RoomSource",
    "Syllabus",
    "Week",
    "__version__",
    "connect",
    "describe",
    "today",
]
