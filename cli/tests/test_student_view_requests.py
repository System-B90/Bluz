"""
Name: test_student_view_requests.py
Purpose: Wire contracts for `bluz student-view` — the day projection and the
         focused-time report the board sends.
Created: 2026-09-18
Author: Michael K. Steinberg
"""

from __future__ import annotations


def test_schedule_reads_the_projection_route(stub_bluz, run_cli):
    stub = stub_bluz()
    stub.envelope("GET", "/api/student-view/schedule", {"events": []})

    result = run_cli(stub, "student-view", "schedule")

    assert result.exit_code == 0
    assert stub.last().method == "GET"
    assert stub.last().path == "/api/student-view/schedule"
    assert stub.last().query == {}


def test_schedule_passes_the_staff_preview_date_and_iteration(stub_bluz, run_cli):
    stub = stub_bluz()
    stub.envelope("GET", "/api/student-view/schedule", {"events": []})

    result = run_cli(
        stub, "student-view", "schedule", "--date", "2026-03-01", "--it", "2026a"
    )

    assert result.exit_code == 0
    assert stub.last().query == {"date": ["2026-03-01"], "it": ["2026a"]}


def test_report_engagement_posts_only_the_duration(stub_bluz, run_cli):
    stub = stub_bluz()
    stub.envelope("POST", "/api/student-view/engagement", None)

    result = run_cli(stub, "student-view", "report-engagement", "45")

    assert result.exit_code == 0
    assert stub.last().method == "POST"
    # No user id and no date: the server takes both from the session and its
    # own clock, so a client can only ever add to its own counter.
    assert stub.last().body == {"seconds": 45}
