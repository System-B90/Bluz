"""
Name: test_examples.py
Purpose: Every shipped example runs end to end against the stub server, so
         the documentation-by-example can never rot.
Created: 2026-10-02
Author: Michael K. Steinberg
"""

from __future__ import annotations

from datetime import date

import pytest
from bluz.examples import available, load
from bluz.examples.__main__ import run

TREE = {
    "id": "c1",
    "title": "Bis90",
    "isDraft": True,
    "c2s": [
        {
            "syllabus": {
                "id": "s1",
                "title": "Math",
                "shuffles": ["A"],
                "s2m": [
                    {
                        "module": {
                            "id": "m1",
                            "title": "Algebra",
                            "m2e": [
                                {
                                    "event": {
                                        "id": "e1",
                                        "title": "Intro",
                                        "minimumDuration": 45,
                                    }
                                }
                            ],
                        }
                    }
                ],
            }
        }
    ],
    "c2w": [{"week": {"id": "w1", "number": 1, "w2d": []}}],
}
EVENTS = [
    {
        "id": "ev",
        "name": "Algebra",
        "type": "הרצאה",
        "startTime": "2026-11-01T06:00:00Z",
        "endTime": "2026-11-01T08:00:00Z",
        "courses": ["k1"],
        "notes": "",
    }
]


@pytest.fixture
def stub(stub_bluz):
    stub = stub_bluz()
    stub.envelope(
        "GET", "/api/iterations/current", {"id": "x", "ganttCurriculumId": "c1"}
    )
    stub.envelope("GET", "/api/gantt/curriculums/c1", TREE)
    stub.envelope("GET", "/api/event", EVENTS)
    stub.envelope("GET", "/api/course", [{"id": "k1", "name": "Apollo"}])
    stub.envelope("GET", "/api/gantt/curriculums/c1/cut", {"cut": False, "count": 0})
    stub.envelope(
        "POST", "/api/gantt/curriculums/c1/cut/plan", {"report": {"decisions": []}}
    )
    return stub


def test_every_example_is_listed_with_a_summary():
    examples = available()
    assert {"walk_curriculum", "weekly_load", "cut_dry_run", "safe_bulk_edit"} <= set(
        examples
    )
    assert all(examples.values())


@pytest.mark.parametrize("name", sorted(available()))
def test_every_example_exposes_main(name):
    assert callable(load(name).main)


def test_walk_curriculum(stub, sdk, capsys):
    load("walk_curriculum").main(sdk(stub))
    out = capsys.readouterr().out
    assert "Bis90" in out and "Algebra" in out and "0.8" in out


def test_weekly_load(stub, sdk, capsys):
    load("weekly_load").main(sdk(stub), date(2026, 11, 1))
    assert "Apollo" in capsys.readouterr().out


def test_cut_dry_run_never_cuts(stub, sdk, capsys):
    load("cut_dry_run").main(sdk(stub))
    assert all(
        r.path != "/api/gantt/curriculums/c1/cut" or r.method == "GET"
        for r in stub.requests
    )
    assert "0 open decision" in capsys.readouterr().out


def test_safe_bulk_edit_defaults_to_dry_run(stub, sdk, capsys):
    load("safe_bulk_edit").main(sdk(stub), date(2026, 11, 1))
    assert {r.method for r in stub.requests} == {"GET"}
    assert "1 of 1" in capsys.readouterr().out


def test_build_syllabus_works_on_a_duplicate(stub, sdk, capsys):
    stub.envelope("POST", "/api/gantt/curriculums/c1/duplicate", {**TREE, "id": "c1"})
    stub.envelope("POST", "/api/gantt/syllabuses", {"id": "s9", "title": "Networking"})
    stub.envelope("POST", "/api/gantt/modules", {"id": "m9", "title": "Foundations"})
    stub.envelope("POST", "/api/gantt/events", {"id": "e9", "title": "OSI model"})

    load("build_syllabus").main(sdk(stub))

    created = [r for r in stub.requests if r.path == "/api/gantt/events"]
    assert len(created) == 4
    assert "/api/gantt/curriculums/c1/duplicate" in [r.path for r in stub.requests]


def test_cli_lists_examples(capsys):
    assert run([]) == 0
    assert "walk_curriculum" in capsys.readouterr().out
    assert run(["nope"]) == 2
