"""
Name: test_calendar_requests.py
Purpose: Wire contracts for the calendar family — shared drafts, snapshots,
         ICS export, and the calendar-event CRUD/compare verbs. Asserts the
         exact method, path, query and JSON body each invocation sends.
Created: 2026-08-23
Author: Michael K. Steinberg
"""

from __future__ import annotations

from conftest import Raw


# --- bluz events (calendar events) ----------------------------------------------


def test_events_list_scopes_by_range_query_params(stub_bluz, run_cli):
    stub = stub_bluz()
    stub.envelope("GET", "/api/event", [])

    result = run_cli(
        stub, "events", "list", "--start", "2026-08-01", "--end", "2026-08-31"
    )

    assert result.exit_code == 0
    assert stub.last().query == {"sd": ["2026-08-01"], "ed": ["2026-08-31"]}


def test_events_list_can_scope_to_an_iteration(stub_bluz, run_cli):
    stub = stub_bluz()
    stub.envelope("GET", "/api/event", [])

    result = run_cli(
        stub,
        "events",
        "list",
        "--start",
        "2026-08-01",
        "--end",
        "2026-08-31",
        "--it",
        "2026a",
    )

    assert result.exit_code == 0
    assert stub.last().query["it"] == ["2026a"]


def test_events_get_passes_comma_ids_in_the_query(stub_bluz, run_cli):
    stub = stub_bluz()
    stub.envelope("GET", "/api/event", [])

    result = run_cli(stub, "events", "get", "e1,e2")

    assert result.exit_code == 0
    assert stub.last().query == {"ids": ["e1,e2"]}


def test_events_create_uses_put_with_the_data_payload(stub_bluz, run_cli):
    """Create rides on PUT: the route treats an id-less body as an insert."""
    stub = stub_bluz()
    stub.envelope("PUT", "/api/event", {"id": "e-new"})

    result = run_cli(
        stub,
        "events",
        "create",
        "--data",
        '{"title": "Lesson", "startDate": "2026-08-24T09:00:00Z"}',
    )

    assert result.exit_code == 0
    assert stub.last().method == "PUT"
    assert stub.last().body == {
        "title": "Lesson",
        "startDate": "2026-08-24T09:00:00Z",
    }


def test_events_update_uses_post_with_the_data_payload(stub_bluz, run_cli):
    stub = stub_bluz()
    stub.envelope("POST", "/api/event", {"ok": True})

    result = run_cli(stub, "events", "update", "--data", '{"id": "e1", "title": "New"}')

    assert result.exit_code == 0
    assert stub.last().method == "POST"
    assert stub.last().body == {"id": "e1", "title": "New"}


def test_events_delete_sends_the_id_as_a_json_string_body(stub_bluz, run_cli):
    """The delete route reads a bare JSON string body, not a path segment."""
    stub = stub_bluz()
    stub.envelope("DELETE", "/api/event", None)

    result = run_cli(stub, "events", "delete", "evt-9", "--yes")

    assert result.exit_code == 0
    assert stub.last().method == "DELETE"
    assert stub.last().body == "evt-9"


def test_events_compare_sends_both_iterations_in_the_query(stub_bluz, run_cli):
    stub = stub_bluz()
    stub.envelope("GET", "/api/event/compare", {"added": []})

    result = run_cli(
        stub,
        "events",
        "compare",
        "--start",
        "2026-09-01",
        "--end",
        "2026-09-30",
        "--it-a",
        "2026a",
        "--it-b",
        "2026b",
    )

    assert result.exit_code == 0
    assert stub.last().query == {
        "sd": ["2026-09-01"],
        "ed": ["2026-09-30"],
        "itA": ["2026a"],
        "itB": ["2026b"],
    }


# --- bluz calendar drafts --------------------------------------------------------


def test_drafts_list_hits_the_collection_without_params(stub_bluz, run_cli):
    stub = stub_bluz()
    stub.envelope("GET", "/api/calendar/drafts", [])

    result = run_cli(stub, "calendar", "drafts", "list")

    assert result.exit_code == 0
    assert stub.last().query == {}


def test_drafts_get_addresses_the_draft_through_the_query(stub_bluz, run_cli):
    stub = stub_bluz()
    stub.envelope("GET", "/api/calendar/drafts", {"id": "dr-1"})

    result = run_cli(stub, "calendar", "drafts", "get", "dr-1", "--it", "2026a")

    assert result.exit_code == 0
    assert stub.last().query == {"id": ["dr-1"], "it": ["2026a"]}


def test_draft_create_posts_label_and_events(stub_bluz, run_cli):
    stub = stub_bluz()
    stub.envelope("POST", "/api/calendar/drafts", {"id": "dr-1"})
    events = '[{"title": "T"}, {"title": "U"}]'

    result = run_cli(
        stub,
        "calendar",
        "drafts",
        "create",
        "--label",
        "Plan A",
        "--events",
        events,
    )

    assert result.exit_code == 0
    assert stub.last().body == {
        "label": "Plan A",
        "events": [{"title": "T"}, {"title": "U"}],
    }


def test_draft_create_can_read_events_from_a_file(stub_bluz, tmp_path, run_cli):
    stub = stub_bluz()
    stub.envelope("POST", "/api/calendar/drafts", {"id": "dr-1"})
    source = tmp_path / "events.json"
    source.write_text('[{"title": "FromFile"}]', encoding="utf-8")

    result = run_cli(
        stub,
        "calendar",
        "drafts",
        "create",
        "--label",
        "Plan B",
        "--events-file",
        str(source),
        "--it",
        "2026a",
    )

    assert result.exit_code == 0
    assert stub.last().body == {"label": "Plan B", "events": [{"title": "FromFile"}]}
    # The iteration scope travels as a query param on writes too.
    assert stub.last().query == {"it": ["2026a"]}


def test_draft_create_rejects_two_event_sources(stub_bluz, run_cli):
    stub = stub_bluz()

    result = run_cli(
        stub,
        "calendar",
        "drafts",
        "create",
        "--label",
        "X",
        "--events",
        "[]",
        "--events-file",
        "whatever.json",
    )

    assert result.exit_code != 0
    assert not stub.requests


def test_draft_update_label_only_leaves_events_out_of_the_body(stub_bluz, run_cli):
    """An update that only renames must not clear the draft's events."""
    stub = stub_bluz()
    stub.envelope("PUT", "/api/calendar/drafts", {"ok": True})

    result = run_cli(stub, "calendar", "drafts", "update", "dr-1", "--label", "Renamed")

    assert result.exit_code == 0
    assert stub.last().method == "PUT"
    assert stub.last().body == {"id": "dr-1", "label": "Renamed"}


def test_draft_update_can_replace_the_events(stub_bluz, run_cli):
    stub = stub_bluz()
    stub.envelope("PUT", "/api/calendar/drafts", {"ok": True})

    result = run_cli(
        stub, "calendar", "drafts", "update", "dr-1", "--events", '[{"title": "N"}]'
    )

    assert result.exit_code == 0
    assert stub.last().body == {"id": "dr-1", "events": [{"title": "N"}]}


def test_draft_delete_goes_through_the_query(stub_bluz, run_cli):
    stub = stub_bluz()
    stub.envelope("DELETE", "/api/calendar/drafts", None)

    result = run_cli(stub, "calendar", "drafts", "delete", "dr-1", "--yes")

    assert result.exit_code == 0
    assert stub.last().method == "DELETE"
    assert stub.last().query == {"id": ["dr-1"]}
    assert stub.last().body is None


# --- bluz calendar snapshots ------------------------------------------------------


def test_snapshot_create_posts_label_and_events(stub_bluz, run_cli):
    stub = stub_bluz()
    stub.envelope("POST", "/api/calendar/snapshots", {"id": "sn-1"})

    result = run_cli(
        stub,
        "calendar",
        "snapshots",
        "create",
        "--label",
        "Before cut",
        "--events",
        "[]",
    )

    assert result.exit_code == 0
    assert stub.last().body == {"label": "Before cut", "events": []}


def test_snapshot_restore_posts_to_the_restore_route(stub_bluz, run_cli):
    stub = stub_bluz()
    stub.envelope("POST", "/api/calendar/snapshots/restore", {"restored": 3})

    result = run_cli(stub, "calendar", "snapshots", "restore", "sn-1", "--yes")

    assert result.exit_code == 0
    assert stub.last().method == "POST"
    assert stub.last().path == "/api/calendar/snapshots/restore"
    assert stub.last().query == {"id": ["sn-1"]}
    assert stub.last().body is None


def test_snapshot_delete_goes_through_the_query(stub_bluz, run_cli):
    stub = stub_bluz()
    stub.envelope("DELETE", "/api/calendar/snapshots", None)

    result = run_cli(stub, "calendar", "snapshots", "delete", "sn-1", "--yes")

    assert result.exit_code == 0
    assert stub.last().query == {"id": ["sn-1"]}


# --- bluz calendar export-ics -----------------------------------------------------


def test_export_ics_downloads_raw_text_into_a_file(stub_bluz, tmp_path, run_cli):
    """The ICS route answers raw text, not the JSON envelope."""
    stub = stub_bluz()
    ics = b"BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n"
    stub.route("GET", "/api/event/export/ics", Raw(ics, "text/calendar; charset=utf-8"))
    out = tmp_path / "schedule.ics"

    result = run_cli(
        stub,
        "calendar",
        "export-ics",
        "--start",
        "2026-08-01",
        "--end",
        "2026-08-31",
        "-o",
        str(out),
    )

    assert result.exit_code == 0
    assert out.read_bytes() == ics


def test_export_ics_scopes_the_range_and_iteration_in_the_query(
    stub_bluz, tmp_path, run_cli
):
    stub = stub_bluz()
    stub.route("GET", "/api/event/export/ics", Raw(b"BEGIN:VCALENDAR", "text/calendar"))

    result = run_cli(
        stub,
        "calendar",
        "export-ics",
        "--start",
        "2026-01-01",
        "--end",
        "2026-12-31",
        "--it",
        "2026a",
        "-o",
        str(tmp_path / "unused.ics"),
    )

    assert result.exit_code == 0
    assert stub.last().query == {
        "sd": ["2026-01-01"],
        "ed": ["2026-12-31"],
        "it": ["2026a"],
    }
