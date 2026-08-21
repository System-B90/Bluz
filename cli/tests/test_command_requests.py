"""
Name: test_command_requests.py
Purpose: Asserts the HTTP request each command actually puts on the wire —
         method, path, query and JSON body — against a real local server.
         Mocking the client would not catch a payload that has drifted from
         the route's contract, which is the bug class these cover.
Created: 2026-08-21
Author: Michael K. Steinberg
"""

from __future__ import annotations

import json


def _json_out(result):
    return json.loads(result.stdout)


# --- bluz health -------------------------------------------------------------


def test_health_reports_and_exits_zero_when_healthy(stub_bluz, run_cli):
    stub = stub_bluz()
    # Bare body, no envelope: /api/health is not an envelope route.
    stub.route("GET", "/api/health", {"status": "healthy", "checks": {"mongo": "up"}})

    result = run_cli(stub, "health")

    assert result.exit_code == 0
    assert _json_out(result) == {"status": "healthy", "checks": {"mongo": "up"}}
    assert stub.last().path == "/api/health"


def test_health_exits_zero_when_degraded(stub_bluz, run_cli):
    """Hive down but Bluz serving is not a failure -- the route answers 200."""
    stub = stub_bluz()
    stub.route("GET", "/api/health", {"status": "degraded", "checks": {"hive": "down"}})

    result = run_cli(stub, "health")

    assert result.exit_code == 0


def test_health_exits_nonzero_when_unhealthy(stub_bluz, run_cli):
    stub = stub_bluz()
    stub.route(
        "GET",
        "/api/health",
        {"status": "unhealthy", "checks": {"mongo": "down"}},
        status=503,
    )

    result = run_cli(stub, "health")

    # Usable as a shell gate. Before get_raw existed the envelope unwrapper
    # rejected this body outright, because "status" was a string and not 0.
    assert result.exit_code == 1
    assert _json_out(result)["checks"] == {"mongo": "down"}


# --- bluz hive ---------------------------------------------------------------


def test_hive_queues_scopes_by_module(stub_bluz, run_cli):
    stub = stub_bluz()
    stub.envelope("GET", "/api/hive/queues", [{"id": 7, "name": "Q"}])

    result = run_cli(stub, "hive", "queues", "--module", "42")

    assert result.exit_code == 0
    # Module-scoped by design: Hive rejects user queues on a lesson rule.
    assert stub.last().query == {"module": ["42"]}


def test_hive_activate_lessons_posts(stub_bluz, run_cli):
    stub = stub_bluz()
    stub.envelope("POST", "/api/hive/lesson-activation", {"activated": 2, "skipped": 1})

    # --quiet because this command reports success before the data, and
    # --quiet is the documented way to get machine-readable output only.
    result = run_cli(stub, "--quiet", "hive", "activate-lessons")

    assert result.exit_code == 0
    assert stub.last().method == "POST"
    assert _json_out(result) == {"activated": 2, "skipped": 1}


# --- bluz events history -----------------------------------------------------


def test_events_history_passes_the_id_as_a_query_param(stub_bluz, run_cli):
    stub = stub_bluz()
    stub.envelope("GET", "/api/event/history", [{"changedAt": "2026-08-21T00:00:00Z"}])

    result = run_cli(stub, "events", "history", "evt-1")

    assert result.exit_code == 0
    # The route reads ?id=, not a path segment.
    assert stub.last().query == {"id": ["evt-1"]}


# --- bluz iterations usage ---------------------------------------------------


def test_iterations_usage_targets_a_given_iteration(stub_bluz, run_cli):
    stub = stub_bluz()
    stub.envelope("GET", "/api/iterations/it-9/usage", {"events": 3})

    result = run_cli(stub, "iterations", "usage", "it-9")

    assert result.exit_code == 0
    assert stub.last().path == "/api/iterations/it-9/usage"


def test_iterations_usage_defaults_to_current(stub_bluz, run_cli):
    stub = stub_bluz()
    stub.envelope("GET", "/api/iterations/current/usage", {"events": 0})

    result = run_cli(stub, "iterations", "usage")

    assert result.exit_code == 0
    assert stub.last().path == "/api/iterations/current/usage"


# --- bluz gantt curriculums cut / cut-plan -----------------------------------

_CUT_DEFAULTS = {
    "force": False,
    "autoSpillover": True,
    "insertBreaks": True,
    "acceptedConstraintMoves": [],
    "weekOverflowResolutions": {},
}


def test_cut_plan_sends_the_full_payload(stub_bluz, run_cli):
    stub = stub_bluz()
    stub.envelope("POST", "/api/gantt/curriculums/c-1/cut/plan", {"report": {}})

    result = run_cli(stub, "gantt", "curriculums", "cut-plan", "c-1")

    assert result.exit_code == 0
    assert stub.last().body == _CUT_DEFAULTS


def test_cut_sends_every_field_the_route_reads(stub_bluz, run_cli):
    """Regression: the body used to carry only `force`.

    The other four fields silently took server defaults, so the
    plan-then-confirm flow could not be driven from a terminal at all.
    """
    stub = stub_bluz()
    stub.envelope("POST", "/api/gantt/curriculums/c-1/cut", {"created": 12})

    result = run_cli(stub, "gantt", "curriculums", "cut", "c-1", "--yes")

    assert result.exit_code == 0
    assert stub.last().body == _CUT_DEFAULTS


def test_cut_forwards_plan_decisions(stub_bluz, run_cli):
    stub = stub_bluz()
    stub.envelope("POST", "/api/gantt/curriculums/c-1/cut", {"created": 1})

    result = run_cli(
        stub,
        "gantt",
        "curriculums",
        "cut",
        "c-1",
        "--yes",
        "--force",
        "--no-insert-breaks",
        "--accepted-constraint-moves",
        '[{"eventId": "e1", "toDayId": "d2"}]',
        "--week-overflow-resolutions",
        '{"w1": "spill"}',
    )

    assert result.exit_code == 0
    assert stub.last().body == {
        "force": True,
        "autoSpillover": True,
        "insertBreaks": False,
        "acceptedConstraintMoves": [{"eventId": "e1", "toDayId": "d2"}],
        "weekOverflowResolutions": {"w1": "spill"},
    }


def test_cut_rejects_a_non_array_of_constraint_moves(stub_bluz, run_cli):
    stub = stub_bluz()
    stub.envelope("POST", "/api/gantt/curriculums/c-1/cut", {})

    result = run_cli(
        stub,
        "gantt",
        "curriculums",
        "cut",
        "c-1",
        "--yes",
        "--accepted-constraint-moves",
        '{"not": "a list"}',
    )

    # Caught locally rather than sent for the server to reject.
    assert result.exit_code != 0
    assert not stub.requests


# --- bluz gantt syllabuses shuffles ------------------------------------------


def test_syllabus_shuffles_lists_usages(stub_bluz, run_cli):
    stub = stub_bluz()
    stub.envelope("GET", "/api/gantt/syllabuses/s-1/shuffles", {"modules": []})

    result = run_cli(stub, "gantt", "syllabuses", "shuffles", "s-1", "--names", "a,b")

    assert result.exit_code == 0
    assert stub.last().query == {"names": ["a,b"]}


def test_set_shuffles_posts_a_trimmed_name_list(stub_bluz, run_cli):
    stub = stub_bluz()
    stub.envelope("POST", "/api/gantt/syllabuses/s-1/shuffles", {"ok": True})

    result = run_cli(
        stub,
        "gantt",
        "syllabuses",
        "set-shuffles",
        "s-1",
        "--shuffles",
        " a , b ,,c ",
        "--yes",
    )

    assert result.exit_code == 0
    assert stub.last().body == {"shuffles": ["a", "b", "c"]}


def test_set_shuffles_can_clear_them_all(stub_bluz, run_cli):
    stub = stub_bluz()
    stub.envelope("POST", "/api/gantt/syllabuses/s-1/shuffles", {"ok": True})

    result = run_cli(
        stub, "gantt", "syllabuses", "set-shuffles", "s-1", "--shuffles", "", "--yes"
    )

    assert result.exit_code == 0
    assert stub.last().body == {"shuffles": []}
