"""
Name: walk_curriculum.py
Purpose: Walk a curriculum tree and total planned minutes per syllabus and module.
Created: 2026-10-02
Author: Michael K. Steinberg

Shows: lookup by title, iterating Curriculum → Syllabus → Module → GanttEvent,
and the per-curriculum `allocated_duration` of an event. One request in total —
`curriculums.get()` returns the whole tree.
"""

from __future__ import annotations

from bluz import Bluz, Curriculum


def syllabus_minutes(curriculum: Curriculum) -> dict[str, int]:
    """Allocated minutes per syllabus title (falls back to the minimum)."""
    totals: dict[str, int] = {}
    for syllabus in curriculum:
        totals[syllabus.title] = sum(
            event.allocated_duration or event.minimum_duration
            for event in syllabus.events
        )
    return totals


def main(bz: Bluz) -> None:
    current = bz.iterations.current()
    curriculum = current.curriculum or next(iter(bz.gantt.curriculums))
    print(
        f"{curriculum.title}  ({len(curriculum)} syllabuses, {len(curriculum.weeks)} weeks)"
    )

    for syllabus in curriculum:
        print(f"\n{syllabus.title}  shuffles={syllabus.shuffles or '-'}")
        for module in syllabus:
            minutes = sum(event.minimum_duration for event in module)
            print(
                f"  {module.title:<40} {len(module):>3} events  {minutes / 60:>6.1f} h"
            )

    print("\nAllocated hours per syllabus:")
    for title, minutes in sorted(
        syllabus_minutes(curriculum).items(), key=lambda kv: -kv[1]
    ):
        print(f"  {title:<40} {minutes / 60:>6.1f}")


if __name__ == "__main__":
    with Bluz() as session:
        main(session)
