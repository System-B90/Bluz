"""
Name: test_examples_demos.py
Purpose: Smoke tests for the boilerplate and demo examples — each runs end to
         end against the stub server and prints what it promises.
Created: 2026-10-02
Author: Michael K. Steinberg
"""

from __future__ import annotations

from datetime import date

import pytest
from bluz.examples import load
from wire_types import Raw

EVENT = {
    "id": "ev",
    "name": "Algebra",
    "type": "הרצאה",
    "startTime": "2026-11-01T06:00:00Z",
    "endTime": "2026-11-01T08:00:00Z",
    "courses": ["k1"],
    "rooms": [{"id": "r1", "source": 0}],
    "notes": "",
}


@pytest.fixture
def stub(stub_bluz):
    stub = stub_bluz()
    stub.envelope("GET", "/api/iterations/current", {"id": "2026b", "label": "B"})
    stub.envelope(
        "GET",
        "/api/course",
        [
            {"id": "root", "name": "Bis90"},
            {"id": "k1", "name": "Apollo", "parentId": "root"},
        ],
    )
    stub.envelope("GET", "/api/rooms", [{"id": "r1", "name": "Lab", "source": 0}])
    stub.envelope("GET", "/api/reservations", [])
    stub.envelope("GET", "/api/event", [EVENT])
    stub.route(
        "GET",
        "/api/auth/session",
        {"user": {"name": "Dana", "email": "d@x"}, "expires": "2099-01-01T00:00:00Z"},
    )
    return stub


def test_login_and_session_masks_the_token(stub, sdk, capsys):
    load("login_and_session").main(sdk(stub))
    out = capsys.readouterr().out
    assert "as Dana <d@x>" in out
    assert "test-token" not in out


def test_course_tree_indents_children(stub, sdk, capsys):
    load("course_tree").main(sdk(stub))
    assert "Bis90\n    Apollo" in capsys.readouterr().out


def test_room_utilization(stub, sdk, capsys):
    load("room_utilization").main(sdk(stub), date(2026, 11, 1))
    out = capsys.readouterr().out
    assert "Lab" in out and "2.0 h" in out


def test_shuffle_audit_flags_imbalance(stub_bluz, sdk, capsys):
    stub = stub_bluz()
    stub.envelope(
        "GET", "/api/iterations/current", {"id": "x", "ganttCurriculumId": "c1"}
    )
    events = [
        {"event": {"id": "e1", "minimumDuration": 60}},
        {"event": {"id": "e2", "minimumDuration": 30, "shuffles": ["A"]}},
        {"event": {"id": "e3", "minimumDuration": 99, "courseIds": ["k1"]}},
    ]
    syllabus = {
        "id": "s1",
        "title": "Math",
        "shuffles": ["A", "B"],
        "s2m": [{"module": {"id": "m1", "m2e": events}}],
    }
    stub.envelope(
        "GET",
        "/api/gantt/curriculums/c1",
        {"id": "c1", "c2s": [{"syllabus": syllabus}]},
    )

    load("shuffle_audit").main(sdk(stub))

    out = capsys.readouterr().out
    assert "UNBALANCED by 30 min" in out and "A=90, B=60" in out


def test_compare_iterations_reads_both_runs(stub, sdk, capsys):
    stub.envelope(
        "GET",
        "/api/iterations",
        [
            {"id": "2026a", "startDate": "2026-01-01T00:00:00Z"},
            {"id": "2026b", "startDate": "2026-07-01T00:00:00Z", "isCurrent": True},
        ],
    )

    load("compare_iterations").main(sdk(stub))

    assert "2026a → 2026b" in capsys.readouterr().out
    scopes = {r.query["it"][0] for r in stub.requests if r.path == "/api/event"}
    assert scopes == {"2026a", "2026b"}


def test_export_calendar_uses_israel_wall_clock(stub, sdk, tmp_path):
    stub.route("GET", "/api/event/export/ics", Raw(b"BEGIN:VCALENDAR"))

    load("export_calendar").main(sdk(stub), date(2026, 11, 1), str(tmp_path))

    rows = (
        (tmp_path / "bluz-2026-11-01.csv").read_text(encoding="utf-8-sig").splitlines()
    )
    assert rows[1].startswith("2026-11-01,08:00,10:00,Algebra")
    assert rows[1].endswith("Apollo,Lab")
    assert (tmp_path / "bluz-2026-11-01.ics").read_bytes() == b"BEGIN:VCALENDAR"


def test_script_template_dry_run_and_error_exit(stub, sdk, capsys):
    template = load("script_template")

    assert template.main(sdk(stub), []) == 0
    assert "dry run" in capsys.readouterr().out

    stub.route("GET", "/api/auth/session", {})
    assert template.main(sdk(stub), []) == 1
    assert "Not signed in" in capsys.readouterr().err


def test_script_template_scopes_the_iteration(stub, sdk):
    load("script_template").main(sdk(stub), ["--iteration", "2025b"])
    assert {"it": ["2025b"]} in [
        r.query for r in stub.requests if r.path == "/api/course"
    ]
