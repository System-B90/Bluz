"""
Name: test_examples_excel.py
Purpose: The Excel import/export examples — header aliases, type parsing,
         error rows, both workbook layouts, create-or-reuse importing and the
         export→import round trip.
Created: 2026-10-02
Author: Michael K. Steinberg
"""

from __future__ import annotations

import pytest
from bluz import Bluz, Curriculum, ModuleEventType
from bluz.examples.excel_to_syllabus import (
    SheetError,
    import_outline,
    read_outline,
    rows_to_outline,
    write_template,
)
from bluz.examples.excel_wide_syllabus import read_wide_outline, write_wide_template
from bluz.examples.syllabus_to_excel import export_outline

pytest.importorskip("openpyxl")

TREE = {
    "id": "c1",
    "title": "Bis90",
    "c2s": [
        {
            "syllabus": {
                "id": "s1",
                "title": "Networking",
                "s2m": [
                    {
                        "module": {
                            "id": "m1",
                            "title": "Foundations",
                            "m2e": [
                                {
                                    "event": {
                                        "id": "e1",
                                        "title": "OSI model",
                                        "type": "הרצאה",
                                        "minimumDuration": 90,
                                        "shuffles": ["A"],
                                        "isCritical": True,
                                    }
                                }
                            ],
                        }
                    }
                ],
            }
        }
    ],
    "c2w": [],
}


# --- parsing --------------------------------------------------------------------------


def test_english_headers_in_any_order():
    outline = rows_to_outline(
        [
            ("Minutes", "Event", "Module", "Syllabus", "Type"),
            (45, "Intro", "Algebra", "Math", "lecture"),
        ]
    )
    event = outline.syllabuses["Math"]["Algebra"][0]
    assert (event.title, event.minutes, event.type) == (
        "Intro",
        45,
        ModuleEventType.LECTURE,
    )


def test_hebrew_headers_and_values():
    outline = rows_to_outline(
        [
            ("סילבוס", "מערך", "מופע", "סוג", "דקות", "שאפלים", "קריטי"),
            ("מתמטיקה", "אלגברה", "תרגול", 'ע"ע', "90", "א; ב", "כן"),
        ]
    )
    event = outline.syllabuses["מתמטיקה"]["אלגברה"][0]
    assert event.type is ModuleEventType.EXERCISE
    assert event.shuffles == ["א", "ב"]
    assert event.critical is True


def test_blank_rows_and_module_only_rows():
    outline = rows_to_outline(
        [
            ("Syllabus", "Module", "Event"),
            (None, None, None),
            ("Math", "Algebra", None),
            ("Physics", None, None),
        ]
    )
    assert outline.syllabuses == {"Math": {"Algebra": []}, "Physics": {}}
    assert outline.event_count == 0


@pytest.mark.parametrize(
    ("rows", "message"),
    [
        ([], "empty"),
        ([("Event", "Minutes")], "missing column"),
        (
            [("Syllabus", "Module", "Event", "Type"), ("S", "M", "E", "lab")],
            "row 2: unknown event type",
        ),
        (
            [("Syllabus", "Module", "Event", "Minutes"), ("S", "M", "E", "lots")],
            "row 2: minutes",
        ),
    ],
)
def test_bad_sheets_name_the_problem(rows, message):
    with pytest.raises(SheetError, match=message):
        rows_to_outline(rows)


def test_template_round_trips_through_openpyxl(tmp_path):
    outline = read_outline(write_template(tmp_path / "t.xlsx"))
    assert list(outline.syllabuses) == ["Networking", "Security"]
    assert outline.event_count == 4
    lab = outline.syllabuses["Networking"]["Foundations"][1]
    assert lab.shuffles == ["A", "B"] and lab.critical


def test_wide_layout(tmp_path):
    outline = read_wide_outline(write_wide_template(tmp_path / "w.xlsx"))
    modules = outline.syllabuses["Networking"]
    assert list(modules) == ["Foundations", "Routing"]
    assert [e.minutes for e in modules["Foundations"]] == [90, 120]


# --- importing -----------------------------------------------------------------------


def test_dry_run_counts_without_writing(stub_bluz, sdk, tmp_path):
    stub = stub_bluz()
    curriculum = Curriculum.from_wire(TREE, sdk(stub))

    report = import_outline(
        curriculum, read_outline(write_template(tmp_path / "t.xlsx")), dry_run=True
    )

    assert stub.requests == []
    assert report.reused == {"syllabus": 1, "module": 1, "event": 1}
    assert report.created == {"syllabus": 1, "module": 2, "event": 3}


def test_import_reuses_existing_and_creates_the_rest(stub_bluz, sdk, tmp_path):
    stub = stub_bluz()
    stub.envelope("POST", "/api/gantt/syllabuses", {"id": "s9", "title": "Security"})
    stub.envelope("POST", "/api/gantt/modules", {"id": "m9", "title": "x"})
    stub.envelope("POST", "/api/gantt/events", {"id": "e9", "title": "x"})
    curriculum = Curriculum.from_wire(TREE, sdk(stub))

    import_outline(curriculum, read_outline(write_template(tmp_path / "t.xlsx")))

    events = [r.body for r in stub.requests if r.path == "/api/gantt/events"]
    assert [e["title"] for e in events] == [
        "Packet capture lab",
        "Static & dynamic routing",
        "BGP reading",
    ]
    lab = events[0]
    assert lab["moduleId"] == "m1"  # reused the existing Foundations module
    assert (
        lab["type"] == 'ע"ע'
        and lab["shuffles"] == ["A", "B"]
        and lab["isCritical"] is True
    )
    assert "isCritical" not in events[1]
    syllabuses = [r.body for r in stub.requests if r.path == "/api/gantt/syllabuses"]
    assert [s["title"] for s in syllabuses] == ["Security"]


def test_export_then_import_is_a_no_op(stub_bluz, sdk, tmp_path):
    stub = stub_bluz()
    curriculum = Curriculum.from_wire(TREE, sdk(stub))

    path = export_outline(curriculum, tmp_path / "out.xlsx")
    report = import_outline(curriculum, read_outline(path), dry_run=True)

    assert report.created == {"syllabus": 0, "module": 0, "event": 0}


def test_export_writes_minutes_rtl(tmp_path):
    from openpyxl import load_workbook

    curriculum = Curriculum.from_wire(TREE)
    sheet = load_workbook(export_outline(curriculum, tmp_path / "o.xlsx")).active
    assert sheet.sheet_view.rightToLeft
    assert [c.value for c in sheet[2]] == [
        "Networking",
        "Foundations",
        "OSI model",
        "הרצאה",
        90,
        "A",
        "yes",
    ]


def test_excel_example_main_writes_a_template_and_dry_runs(
    stub_bluz, sdk, tmp_path, monkeypatch, capsys
):
    from bluz.examples import excel_to_syllabus

    stub = stub_bluz()
    stub.envelope(
        "GET", "/api/iterations/current", {"id": "x", "ganttCurriculumId": "c1"}
    )
    stub.envelope("GET", "/api/gantt/curriculums/c1", TREE)
    monkeypatch.chdir(tmp_path)
    monkeypatch.delenv("BLUZ_EXCEL", raising=False)

    excel_to_syllabus.main(sdk(stub))

    out = capsys.readouterr().out
    assert "wrote a template" in out and "Would import" in out
    assert (tmp_path / "bluz-syllabus-template.xlsx").exists()
    assert {r.method for r in stub.requests} == {"GET"}


def test_session_type_is_importable():
    assert Bluz  # the examples import from the public surface only
