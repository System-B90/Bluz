"""
Name: export_calendar.py
Purpose: Export a month of the schedule to ICS and to CSV (for Excel / pandas).
Created: 2026-10-02
Author: Michael K. Steinberg

Shows: `events.export_ics()` (server-rendered calendar), and flattening
models into rows with resolved course and room names.
"""

from __future__ import annotations

import csv
from datetime import date, timedelta
from pathlib import Path

from bluz import APP_TIMEZONE, Bluz, today


def write_csv(bz: Bluz, start: date, end: date, path: Path) -> int:
    courses = {c.id: c.name for c in bz.courses.list()}
    rooms = {(str(r.id), int(r.source)): r.name for r in bz.rooms.list()}
    events = bz.events.list(start, end)
    with path.open(
        "w", newline="", encoding="utf-8-sig"
    ) as handle:  # BOM: Excel reads Hebrew
        writer = csv.writer(handle)
        writer.writerow(["date", "start", "end", "name", "type", "courses", "rooms"])
        for event in sorted(events, key=lambda e: e.start_time):
            local_start = event.start_time.astimezone(APP_TIMEZONE)
            local_end = event.end_time.astimezone(APP_TIMEZONE)
            writer.writerow(
                [
                    local_start.date().isoformat(),
                    f"{local_start:%H:%M}",
                    f"{local_end:%H:%M}",
                    event.name,
                    str(event.type),
                    "; ".join(courses.get(c, c) for c in event.courses),
                    "; ".join(
                        rooms.get((str(r.id), int(r.source)), str(r.id))
                        for r in event.rooms
                    ),
                ]
            )
    return len(events)


def main(bz: Bluz, start: date | None = None, out_dir: str = ".") -> None:
    start = start or today()
    end = start + timedelta(days=31)
    folder = Path(out_dir)
    ics = folder / f"bluz-{start}.ics"
    ics.write_bytes(bz.events.export_ics(start, end))
    count = write_csv(bz, start, end, folder / f"bluz-{start}.csv")
    print(f"Wrote {ics} and {count} rows to bluz-{start}.csv")


if __name__ == "__main__":
    with Bluz() as session:
        main(session)
