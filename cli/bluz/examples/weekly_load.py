"""
Name: weekly_load.py
Purpose: Scheduled hours per course for the coming week, from calendar events.
Created: 2026-10-02
Author: Michael K. Steinberg

Shows: `events.list()` with real `date`s, `Event.duration` as a timedelta,
`Collection.where()`, and mapping course ids to names with one request.
"""

from __future__ import annotations

from collections import defaultdict
from datetime import date, timedelta

from bluz import Bluz, EventType, today


def main(bz: Bluz, start: date | None = None) -> None:
    start = start or today()
    end = start + timedelta(days=7)
    events = bz.events.list(start, end)
    names = {course.id: course.name for course in bz.courses.list()}

    hours: dict[str, float] = defaultdict(float)
    for event in events:
        if event.type in (EventType.BREAK, EventType.PRAYER):
            continue
        for course_id in event.courses:
            hours[names.get(course_id, course_id)] += (
                event.duration.total_seconds() / 3600
            )

    print(f"{len(events)} events between {start} and {end}")
    lectures = events.where(type=EventType.LECTURE)
    print(f"{len(lectures)} lectures\n")
    for course, total in sorted(hours.items(), key=lambda kv: -kv[1]):
        print(f"  {course:<30} {total:>6.1f} h")


if __name__ == "__main__":
    with Bluz() as session:
        main(session)
