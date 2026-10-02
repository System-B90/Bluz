"""
Name: room_utilization.py
Purpose: Booked hours per room for a week — calendar events plus reservations.
Created: 2026-10-02
Author: Michael K. Steinberg

Shows: matching an event's `{id, source}` room refs to `Room` objects,
summing timedeltas, and pulling reservations for the same range.
"""

from __future__ import annotations

from collections import defaultdict
from datetime import date, timedelta

from bluz import Bluz, today


def main(bz: Bluz, start: date | None = None) -> None:
    start = start or today()
    end = start + timedelta(days=7)
    rooms = {(str(room.id), int(room.source)): room for room in bz.rooms.list()}
    booked: dict[tuple[str, int], timedelta] = defaultdict(timedelta)

    for event in bz.events.list(start, end):
        for ref in event.rooms:
            booked[(str(ref.id), int(ref.source))] += event.duration
    for reservation in bz.reservations.list(start=start, end=end):
        key = (str(reservation.room_id), int(reservation.room_source))
        booked[key] += reservation.end - reservation.start

    print(f"Room use {start} → {end}")
    for key, used in sorted(booked.items(), key=lambda kv: -kv[1]):
        room = rooms.get(key)
        name = room.name if room else f"unknown room {key[0]}"
        print(f"  {name:<30} {used.total_seconds() / 3600:>6.1f} h")
    idle = [room.name for key, room in rooms.items() if key not in booked]
    print(f"\n{len(idle)} rooms unused: {', '.join(sorted(idle)[:15])}")


if __name__ == "__main__":
    with Bluz() as session:
        main(session)
