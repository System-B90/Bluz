"""
Name: compare_iterations.py
Purpose: Compare event counts and hours by type between this iteration and the previous one.
Created: 2026-10-02
Author: Michael K. Steinberg

Shows: `bz.scoped(iteration)` to read a past run with the same code, and
aligning two runs by their start dates.
"""

from __future__ import annotations

from collections import defaultdict
from datetime import timedelta

from bluz import Bluz, Iteration


def hours_by_type(bz: Bluz, iteration: Iteration, days: int) -> dict[str, float]:
    if iteration.start_date is None:
        return {}
    start = iteration.start_date.date()
    totals: dict[str, float] = defaultdict(float)
    for event in bz.scoped(iteration).events.list(start, start + timedelta(days=days)):
        totals[str(event.type)] += event.duration.total_seconds() / 3600
    return dict(totals)


def main(bz: Bluz, days: int = 14) -> None:
    runs = sorted(
        (it for it in bz.iterations.list() if it.start_date is not None),
        key=lambda it: it.start_date or 0,
    )
    current = next((it for it in runs if it.is_current), None)
    if current is None or runs.index(current) == 0:
        print("Need a current iteration with an earlier one to compare against.")
        return
    previous = runs[runs.index(current) - 1]
    now, before = hours_by_type(bz, current, days), hours_by_type(bz, previous, days)
    print(f"First {days} days: {previous.id} → {current.id}")
    for kind in sorted(set(now) | set(before)):
        print(
            f"  {kind:<12} {before.get(kind, 0):>7.1f} h → {now.get(kind, 0):>7.1f} h"
        )


if __name__ == "__main__":
    with Bluz() as session:
        main(session)
