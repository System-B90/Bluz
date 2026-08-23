"""
Name: test_platform_requests.py
Purpose: Wire contracts for the platform command families — iterations,
         settings, personal settings, integrations and the Hive proxies.
         Asserts the exact method, path, query and JSON body on the wire.
         Prayer-time settings are deliberately absent (#528: wrong key).
Created: 2026-08-23
Author: Michael K. Steinberg
"""

from __future__ import annotations

import json


def _json_out(result):
    return json.loads(result.stdout)


# --- bluz iterations ---------------------------------------------------------------


def test_iterations_list_hits_the_collection(stub_bluz, run_cli):
    stub = stub_bluz()
    stub.envelope("GET", "/api/iterations", [])

    result = run_cli(stub, "iterations", "list")

    assert result.exit_code == 0
    assert stub.last().method == "GET"


def test_iterations_current_reads_the_current_route(stub_bluz, run_cli):
    stub = stub_bluz()
    stub.envelope("GET", "/api/iterations/current", {"id": "2026a"})

    result = run_cli(stub, "iterations", "current")

    assert result.exit_code == 0
    assert stub.last().path == "/api/iterations/current"


def test_iterations_get_addresses_one_by_path_segment(stub_bluz, run_cli):
    stub = stub_bluz()
    stub.envelope("GET", "/api/iterations/2026a", {"id": "2026a"})

    result = run_cli(stub, "iterations", "get", "2026a")

    assert result.exit_code == 0
    assert stub.last().path == "/api/iterations/2026a"


def test_iteration_register_posts_the_id_and_label(stub_bluz, run_cli):
    stub = stub_bluz()
    stub.envelope("POST", "/api/iterations", {"id": "2026b"})

    result = run_cli(stub, "iterations", "register", "2026b", "--label", "Run 2026b")

    assert result.exit_code == 0
    assert stub.last().body == {"id": "2026b", "label": "Run 2026b"}


def test_iteration_register_forwards_every_optional_field(stub_bluz, run_cli):
    stub = stub_bluz()
    stub.envelope("POST", "/api/iterations", {"id": "2026b"})

    result = run_cli(
        stub,
        "iterations",
        "register",
        "2026b",
        "--label",
        "Run 2026b",
        "--db-name",
        "bluz_2026b",
        "--hive-url",
        "https://hive.example.com",
        "--start-date",
        "2026-09-01",
        "--end-date",
        "2027-02-28",
        "--gantt-curriculum-id",
        "cur-1",
    )

    assert result.exit_code == 0
    assert stub.last().body == {
        "id": "2026b",
        "label": "Run 2026b",
        "dbName": "bluz_2026b",
        "hiveUrl": "https://hive.example.com",
        "startDate": "2026-09-01",
        "endDate": "2027-02-28",
        "ganttCurriculumId": "cur-1",
    }


def test_iteration_patch_sends_only_the_fields_it_was_given(stub_bluz, run_cli):
    stub = stub_bluz()
    stub.envelope("PATCH", "/api/iterations/2026a", {"ok": True})

    result = run_cli(
        stub,
        "iterations",
        "patch",
        "2026a",
        "--gantt-curriculum-id",
        "cur-2",
        "--current",
    )

    assert result.exit_code == 0
    assert stub.last().method == "PATCH"
    assert stub.last().body == {
        "ganttCurriculumId": "cur-2",
        "isCurrent": True,
    }


def test_iteration_patch_refuses_an_empty_change_set(stub_bluz, run_cli):
    stub = stub_bluz()

    result = run_cli(stub, "iterations", "patch", "2026a")

    assert result.exit_code != 0
    assert not stub.requests


def test_set_current_patches_is_current_true(stub_bluz, run_cli):
    stub = stub_bluz()
    stub.envelope("PATCH", "/api/iterations/2026b", {"ok": True})

    result = run_cli(stub, "iterations", "set-current", "2026b")

    assert result.exit_code == 0
    assert stub.last().body == {"isCurrent": True}


def test_iteration_delete_removes_by_path_with_no_body(stub_bluz, run_cli):
    stub = stub_bluz()
    stub.envelope("DELETE", "/api/iterations/2026b", None)

    result = run_cli(stub, "iterations", "delete", "2026b", "--yes")

    assert result.exit_code == 0
    assert stub.last().method == "DELETE"
    assert stub.last().body is None


def test_sync_hive_posts_to_the_iteration_scoped_route(stub_bluz, run_cli):
    stub = stub_bluz()
    stub.envelope("POST", "/api/iterations/2026a/sync-hive", {"synced": 5})

    result = run_cli(stub, "iterations", "sync-hive", "2026a")

    assert result.exit_code == 0
    assert stub.last().path == "/api/iterations/2026a/sync-hive"
    assert stub.last().body is None


# --- bluz settings -------------------------------------------------------------------


def test_settings_list_is_static_and_makes_no_request(stub_bluz, run_cli):
    """The server has no enumeration route — the list is compiled in."""
    stub = stub_bluz()

    result = run_cli(stub, "settings", "list")

    assert result.exit_code == 0
    assert not stub.requests


def test_settings_get_reads_by_key_in_the_path(stub_bluz, run_cli):
    stub = stub_bluz()
    stub.envelope("GET", "/api/settings/schedule", {"dayStart": "08:00"})

    result = run_cli(stub, "settings", "get", "schedule")

    assert result.exit_code == 0
    assert stub.last().path == "/api/settings/schedule"


def test_settings_set_posts_the_parsed_value_under_the_key(stub_bluz, run_cli):
    stub = stub_bluz()
    stub.envelope("POST", "/api/settings/schedule", None)

    result = run_cli(
        stub, "settings", "set", "schedule", "--value", '{"dayStart": "08:30"}'
    )

    assert result.exit_code == 0
    assert stub.last().method == "POST"
    assert stub.last().body == {"dayStart": "08:30"}


def test_settings_get_schedule_uses_the_canonical_key(stub_bluz, run_cli):
    stub = stub_bluz()
    stub.envelope("GET", "/api/settings/schedule", {})

    result = run_cli(stub, "settings", "get-schedule")

    assert result.exit_code == 0
    assert stub.last().path == "/api/settings/schedule"


# --- bluz personal ---------------------------------------------------------------------


def test_personal_get_reads_the_document(stub_bluz, run_cli):
    stub = stub_bluz()
    stub.envelope("GET", "/api/personal-settings", {"groups": ["g1"]})

    result = run_cli(stub, "personal", "get")

    assert result.exit_code == 0
    assert stub.last().path == "/api/personal-settings"


def test_personal_set_merges_field_flags_onto_current_values(stub_bluz, run_cli):
    """The endpoint replaces the whole document, so flags merge over current."""
    stub = stub_bluz()
    stub.envelope("GET", "/api/personal-settings", {"groups": ["g1"], "theme": "dark"})
    stub.envelope("POST", "/api/personal-settings", {"ok": True})

    result = run_cli(
        stub,
        "--quiet",
        "personal",
        "set",
        "--instructors",
        " i9 , i10 ",
        "--google-enabled",
    )

    assert result.exit_code == 0
    assert len(stub.requests) == 2
    assert stub.last().method == "POST"
    # Comma lists are split and trimmed; booleans pass through verbatim;
    # untouched keys ride along from the read.
    assert stub.last().body == {
        "groups": ["g1"],
        "theme": "dark",
        "instructors": ["i9", "i10"],
        "googleCalendarEnabled": True,
    }


def test_personal_set_data_bypasses_the_merge(stub_bluz, run_cli):
    stub = stub_bluz()
    stub.envelope("POST", "/api/personal-settings", {"ok": True})

    result = run_cli(stub, "personal", "set", "--data", '{"onlyThis": true}')

    assert result.exit_code == 0
    # --data writes verbatim: no current-values read, just the one POST.
    assert [(r.method, r.path) for r in stub.requests] == [
        ("POST", "/api/personal-settings")
    ]
    assert stub.last().body == {"onlyThis": True}


def test_personal_set_demands_something_to_change(stub_bluz, run_cli):
    stub = stub_bluz()
    # The merge path reads the current document before it can tell whether
    # anything was asked of it.
    stub.envelope("GET", "/api/personal-settings", {"groups": []})

    result = run_cli(stub, "personal", "set")

    assert result.exit_code != 0
    # The read happened, but nothing was written.
    assert [(r.method, r.path) for r in stub.requests] == [
        ("GET", "/api/personal-settings")
    ]


# --- bluz integrations google -------------------------------------------------------------


def test_google_status_reads_the_status_route(stub_bluz, run_cli):
    stub = stub_bluz()
    stub.envelope(
        "GET", "/api/integrations/google-calendar/status", {"connected": False}
    )

    result = run_cli(stub, "integrations", "google", "status")

    assert result.exit_code == 0
    assert stub.last().path == "/api/integrations/google-calendar/status"


def test_google_connect_posts_the_authorization_code(stub_bluz, run_cli):
    stub = stub_bluz()
    stub.envelope("POST", "/api/integrations/google-calendar/connect", None)

    result = run_cli(stub, "integrations", "google", "connect", "--code", "4/abc123")

    assert result.exit_code == 0
    assert stub.last().body == {"code": "4/abc123"}


def test_google_disconnect_posts_without_a_body(stub_bluz, run_cli):
    stub = stub_bluz()
    stub.envelope("POST", "/api/integrations/google-calendar/disconnect", None)

    result = run_cli(stub, "integrations", "google", "disconnect", "--yes")

    assert result.exit_code == 0
    assert stub.last().method == "POST"
    assert stub.last().body is None


def test_google_sync_posts_and_reports_the_result(stub_bluz, run_cli):
    stub = stub_bluz()
    stub.envelope("POST", "/api/integrations/google-calendar/sync", {"pushed": 2})

    # --quiet: the command reports success before the data, and --quiet is
    # the documented way to get machine-readable output only.
    result = run_cli(stub, "--quiet", "integrations", "google", "sync")

    assert result.exit_code == 0
    assert _json_out(result) == {"pushed": 2}


# --- bluz hive ------------------------------------------------------------------------------


def test_hive_simple_proxy_lists_hit_their_own_route(stub_bluz, run_cli):
    stub = stub_bluz()
    stub.envelope("GET", "/api/hive/users", [{"id": 1}])

    result = run_cli(stub, "hive", "users")

    assert result.exit_code == 0
    assert stub.last().path == "/api/hive/users"


def test_hive_lessons_forwards_both_filters_as_query_params(stub_bluz, run_cli):
    stub = stub_bluz()
    stub.envelope("GET", "/api/hive/lessons", [])

    result = run_cli(
        stub,
        "hive",
        "lessons",
        "--module-id",
        "m1",
        "--program-ids",
        "p1,p2",
    )

    assert result.exit_code == 0
    assert stub.last().query == {
        "module__id": ["m1"],
        "module__parent_subject__parent_program_id__in": ["p1,p2"],
    }
