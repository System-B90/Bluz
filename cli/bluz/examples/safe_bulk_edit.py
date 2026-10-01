"""
Name: safe_bulk_edit.py
Purpose: Snapshot the calendar, bulk-edit events, and roll back on failure.
Created: 2026-10-02
Author: Michael K. Steinberg

Shows: `snapshots.create()` as a restore point, editing models in place and
`event.save()`, and `snapshot.restore()`. DRY_RUN is on by default — flip it
to actually write.
"""

from __future__ import annotations

from datetime import date, timedelta

from bluz import Bluz, BluzError, today

DRY_RUN = True
TAG = "[reviewed]"


def main(bz: Bluz, start: date | None = None) -> None:
    start = start or today()
    events = bz.events.list(start, start + timedelta(days=7))
    targets = [event for event in events if TAG not in event.notes and not event.locked]
    print(f"{len(targets)} of {len(events)} events would be tagged {TAG!r}")
    if DRY_RUN or not targets:
        return

    snapshot = bz.snapshots.create(f"before tagging {start}", events)
    try:
        for event in targets:
            event.notes = f"{event.notes} {TAG}".strip()
            event.save()
    except BluzError as exc:
        print(f"Failed ({exc}); restoring snapshot {snapshot.id}")
        snapshot.restore()
        raise
    print(
        f"Tagged {len(targets)} events. Undo with: bz.snapshots.restore({snapshot.id!r})"
    )


if __name__ == "__main__":
    with Bluz() as session:
        main(session)
