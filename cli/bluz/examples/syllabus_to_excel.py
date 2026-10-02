"""
Name: syllabus_to_excel.py
Purpose: Export a curriculum's syllabuses to the flat Excel layout the importer reads.
Created: 2026-10-02
Author: Michael K. Steinberg

Needs `pip install "bluz[excel]"` (openpyxl).

Round trip: export, edit in Excel, import back with `excel_to_syllabus` —
existing rows are reused, new rows are created. The sheet is right-to-left so
Hebrew titles read naturally.
"""

from __future__ import annotations

from pathlib import Path

from bluz import Bluz, Curriculum

COLUMNS = [
    "Syllabus",
    "Module",
    "Event",
    "Type",
    "Minutes",
    "Allocated",
    "Shuffles",
    "Critical",
]


def export_outline(curriculum: Curriculum, path: str | Path) -> Path:
    """Write every event of `curriculum` as one row."""
    from openpyxl import Workbook
    from openpyxl.styles import Font

    workbook = Workbook()
    sheet = workbook.active
    assert sheet is not None
    sheet.title = "Syllabuses"
    sheet.sheet_view.rightToLeft = True
    sheet.append(COLUMNS)
    for cell in sheet[1]:
        cell.font = Font(bold=True)
    sheet.freeze_panes = "A2"

    for syllabus in curriculum:
        if not syllabus.modules:
            sheet.append([syllabus.title])
        for module in syllabus:
            if not module.events:
                sheet.append([syllabus.title, module.title])
            for event in module:
                sheet.append(
                    [
                        syllabus.title,
                        module.title,
                        event.title,
                        str(event.type or ""),
                        event.minimum_duration,
                        event.allocated_duration,
                        ",".join(event.shuffles),
                        "yes" if event.is_critical else "",
                    ]
                )
    for column, width in zip("ABCDEFGH", (24, 24, 36, 10, 9, 10, 14, 9), strict=True):
        sheet.column_dimensions[column].width = width
    target = Path(path)
    workbook.save(target)
    return target


def main(bz: Bluz, path: str = "bluz-syllabuses.xlsx") -> None:
    curriculum = bz.iterations.current().curriculum
    if curriculum is None:
        print("The current iteration has no linked curriculum.")
        return
    target = export_outline(curriculum, path)
    print(f"Wrote {len(curriculum.events)} events of {curriculum.title!r} to {target}")


if __name__ == "__main__":
    with Bluz() as session:
        main(session)
