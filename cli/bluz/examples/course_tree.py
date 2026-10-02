"""
Name: course_tree.py
Purpose: Print the course tree (Bis90 → Apollo/Mivtzar/Sphinx → shuffles) with linked syllabuses.
Created: 2026-10-02
Author: Michael K. Steinberg

Shows: building a parent→children index from one `courses.list()` call
instead of calling `course.children` per node (which would refetch each time),
and joining syllabuses to courses through `Syllabus.course_ids`.
"""

from __future__ import annotations

from collections import defaultdict

from bluz import Bluz, Course


def print_tree(
    courses: list[Course], syllabuses_by_course: dict[str, list[str]]
) -> None:
    children: dict[str | None, list[Course]] = defaultdict(list)
    for course in courses:
        children[course.parent_id].append(course)

    def walk(parent: str | None, depth: int) -> None:
        for course in sorted(children[parent], key=lambda c: c.name):
            linked = syllabuses_by_course.get(course.id, [])
            suffix = f"  [{', '.join(linked)}]" if linked else ""
            print(f"{'    ' * depth}{course.name}{suffix}")
            walk(course.id, depth + 1)

    walk(None, 0)


def main(bz: Bluz) -> None:
    courses = bz.courses.list()
    syllabuses_by_course: dict[str, list[str]] = defaultdict(list)
    curriculum = bz.iterations.current().curriculum
    if curriculum is not None:
        for syllabus in curriculum:
            for course_id in syllabus.course_ids:
                syllabuses_by_course[course_id].append(syllabus.title)
    print_tree(courses, syllabuses_by_course)


if __name__ == "__main__":
    with Bluz() as session:
        main(session)
