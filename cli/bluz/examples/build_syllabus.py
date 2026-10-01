"""
Name: build_syllabus.py
Purpose: Create a syllabus with modules and events from a plain Python outline.
Created: 2026-10-02
Author: Michael K. Steinberg

Shows: `create_syllabus` / `create_module` / `create_event` on the objects
themselves, typed enums for event kinds, and reading the result back. Runs on
a draft copy of the current curriculum so the original is never touched.
"""

from __future__ import annotations

import rich

from bluz import Bluz, Curriculum, ModuleEventType

# syllabus → module → [(event title, kind, minutes)]
OUTLINE: dict[str, dict[str, list[tuple[str, ModuleEventType, int]]]] = {
    "Networking": {
        "Foundations": [
            ("OSI model", ModuleEventType.LECTURE, 90),
            ("Packet capture lab", ModuleEventType.EXERCISE, 120),
        ],
        "Routing": [
            ("Static & dynamic routing", ModuleEventType.LECTURE, 90),
            ("Self study: BGP", ModuleEventType.SELF_TEACHING, 60),
        ],
    }
}


def build(
    curriculum: Curriculum,
    outline: dict[str, dict[str, list[tuple[str, ModuleEventType, int]]]],
) -> None:
    """Create every syllabus/module/event in `outline` under `curriculum`."""
    for syllabus_title, modules in outline.items():
        syllabus = curriculum.create_syllabus(syllabus_title)
        for module_title, events in modules.items():
            module = syllabus.create_module(module_title)
            for title, kind, minutes in events:
                module.create_event(title, type=kind, minimum_duration=minutes)


def main(bz: Bluz) -> None:
    source = bz.iterations.current().curriculum
    if source is None:
        print("The current iteration has no linked curriculum.")
        return
    draft = source.duplicate(title=f"{source.title} (example draft)", is_draft=True)
    build(draft, OUTLINE)
    draft = draft.refresh()
    for syllabus in draft:
        if syllabus.title in OUTLINE:
            rich.print(syllabus.tree())
    print(f"Delete the draft with: bz.gantt.curriculums.delete({draft.id!r})")


if __name__ == "__main__":
    with Bluz() as session:
        main(session)
