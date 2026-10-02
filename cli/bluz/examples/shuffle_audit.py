"""
Name: shuffle_audit.py
Purpose: Check every syllabus's shuffles have the same daily load — the core scheduling rule.
Created: 2026-10-02
Author: Michael K. Steinberg

Rule being checked: within a syllabus, every shuffle (student group) must get
the same total time; events with no `shuffles` apply to all of them, and
events limited to `course_ids` are outside the shuffle rule. A shuffle group
(`group_id`) is the same lesson given in parallel, so it counts once per
shuffle. Reads only.
"""

from __future__ import annotations

from collections import defaultdict

from bluz import Bluz, Syllabus


def shuffle_minutes(syllabus: Syllabus) -> dict[str, int]:
    """Planned minutes per shuffle name."""
    totals: dict[str, int] = defaultdict(int)
    names = syllabus.shuffles or ["(all)"]
    for event in syllabus.events:
        if event.course_ids:
            continue
        minutes = event.minimum_duration
        for name in event.shuffles or names:
            totals[name] += minutes
    return dict(totals)


def main(bz: Bluz) -> None:
    curriculum = bz.iterations.current().curriculum
    if curriculum is None:
        print("The current iteration has no linked curriculum.")
        return
    problems = 0
    for syllabus in curriculum:
        if len(syllabus.shuffles) < 2:
            continue
        totals = shuffle_minutes(syllabus)
        spread = max(totals.values(), default=0) - min(totals.values(), default=0)
        status = "ok" if spread == 0 else f"UNBALANCED by {spread} min"
        problems += spread != 0
        print(
            f"{syllabus.title:<30} {status}  "
            + ", ".join(f"{k}={v}" for k, v in totals.items())
        )
    print(f"\n{problems} syllabus(es) need attention")


if __name__ == "__main__":
    with Bluz() as session:
        main(session)
