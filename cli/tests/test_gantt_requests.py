"""
Name: test_gantt_requests.py
Purpose: Wire contracts for the gantt command family — the exact method, path,
         query and JSON body each invocation puts on the wire, against the
         StubBluz server. Days/weeks link/unlink are deliberately absent (#527).
Created: 2026-08-23
Author: Michael K. Steinberg
"""

from __future__ import annotations

import json

from wire_types import Raw


def _json_out(result):
    return json.loads(result.stdout)


# --- entity CRUD: curriculums -------------------------------------------------


def test_curriculum_list_round_trips_the_id_title_map(stub_bluz, run_cli):
    stub = stub_bluz()
    stub.envelope("GET", "/api/gantt/curriculums", {"c1": "Curriculum One"})

    result = run_cli(stub, "gantt", "curriculums", "list")

    assert result.exit_code == 0
    assert stub.last().method == "GET"
    assert stub.last().query == {}
    # The map's keys become row ids.
    assert _json_out(result) == [{"id": "c1", "title": "Curriculum One"}]


def test_curriculum_list_sends_with_parents_as_a_query_flag(stub_bluz, run_cli):
    stub = stub_bluz()
    stub.envelope(
        "GET", "/api/gantt/curriculums", {"c1": {"title": "C1", "syllabus": "s1"}}
    )

    result = run_cli(stub, "gantt", "curriculums", "list", "--with-parents")

    assert result.exit_code == 0
    assert stub.last().query == {"withParents": ["1"]}
    # Object values spread into the row instead of becoming the title.
    assert _json_out(result) == [{"id": "c1", "title": "C1", "syllabus": "s1"}]


def test_curriculum_get_fetches_one_by_path_segment(stub_bluz, run_cli):
    stub = stub_bluz()
    stub.envelope("GET", "/api/gantt/curriculums/c-1", {"id": "c-1"})

    result = run_cli(stub, "gantt", "curriculums", "get", "c-1")

    assert result.exit_code == 0
    assert stub.last().path == "/api/gantt/curriculums/c-1"


def test_curriculum_get_many_passes_ids_in_the_query(stub_bluz, run_cli):
    stub = stub_bluz()
    stub.envelope("GET", "/api/gantt/curriculums", {"a": {}, "b": {}})

    result = run_cli(stub, "gantt", "curriculums", "get-many", "a,b")

    assert result.exit_code == 0
    assert stub.last().query == {"ids": ["a,b"]}


def test_curriculum_create_posts_the_data_payload_verbatim(stub_bluz, run_cli):
    stub = stub_bluz()
    stub.envelope("POST", "/api/gantt/curriculums", {"id": "c-2"})

    result = run_cli(
        stub,
        "gantt",
        "curriculums",
        "create",
        "--data",
        '{"title": "New Curriculum"}',
    )

    assert result.exit_code == 0
    assert stub.last().method == "POST"
    assert stub.last().body == {"title": "New Curriculum"}


def test_syllabus_update_patches_the_item_path(stub_bluz, run_cli):
    stub = stub_bluz()
    stub.envelope("PATCH", "/api/gantt/syllabuses/s-1", {"ok": True})

    result = run_cli(
        stub, "gantt", "syllabuses", "update", "s-1", "--data", '{"credits": 5}'
    )

    assert result.exit_code == 0
    assert stub.last().method == "PATCH"
    assert stub.last().path == "/api/gantt/syllabuses/s-1"
    assert stub.last().body == {"credits": 5}


def test_day_create_posts_a_json_body(stub_bluz, run_cli):
    stub = stub_bluz()
    stub.envelope("POST", "/api/gantt/days", {"id": "d-1"})

    result = run_cli(stub, "gantt", "days", "create", "--data", '{"index": 3}')

    assert result.exit_code == 0
    assert stub.last().body == {"index": 3}


def test_week_delete_removes_by_path_and_sends_no_body(stub_bluz, run_cli):
    stub = stub_bluz()
    stub.envelope("DELETE", "/api/gantt/weeks/w-1", None)

    result = run_cli(stub, "gantt", "weeks", "delete", "w-1", "--yes")

    assert result.exit_code == 0
    assert stub.last().method == "DELETE"
    assert stub.last().path == "/api/gantt/weeks/w-1"
    assert stub.last().body is None


# --- link / allocate-time / reorder -------------------------------------------


def test_syllabus_link_posts_the_new_parent_id(stub_bluz, run_cli):
    stub = stub_bluz()
    stub.envelope("POST", "/api/gantt/syllabuses/s-1/link", {"ok": True})

    result = run_cli(stub, "gantt", "syllabuses", "link", "s-1", "c-9")

    assert result.exit_code == 0
    assert stub.last().body == {"newParentId": "c-9"}


def test_syllabus_unlink_deletes_with_the_old_parent_id_in_the_body(stub_bluz, run_cli):
    stub = stub_bluz()
    stub.envelope("DELETE", "/api/gantt/syllabuses/s-1/link", None)

    result = run_cli(stub, "gantt", "syllabuses", "unlink", "s-1", "c-9")

    assert result.exit_code == 0
    assert stub.last().method == "DELETE"
    assert stub.last().body == {"oldParentId": "c-9"}


def test_module_get_time_scopes_by_container_query_param(stub_bluz, run_cli):
    stub = stub_bluz()
    stub.envelope("GET", "/api/gantt/modules/m-1/allocate-time", {"duration": 30})

    result = run_cli(stub, "gantt", "modules", "get-time", "m-1", "c-1")

    assert result.exit_code == 0
    assert stub.last().query == {"containerId": ["c-1"]}


def test_module_set_time_posts_container_and_duration(stub_bluz, run_cli):
    stub = stub_bluz()
    stub.envelope("POST", "/api/gantt/modules/m-1/allocate-time", None)

    result = run_cli(stub, "gantt", "modules", "set-time", "m-1", "c-1", "45")

    assert result.exit_code == 0
    assert stub.last().body == {"containerId": "c-1", "duration": 45}


def test_syllabus_reorder_modules_posts_the_ordered_id_list(stub_bluz, run_cli):
    stub = stub_bluz()
    stub.envelope("POST", "/api/gantt/syllabuses/s-1/reorder-modules", None)

    result = run_cli(stub, "gantt", "syllabuses", "reorder-modules", "s-1", "m3,m1,m2")

    assert result.exit_code == 0
    assert stub.last().body == {"moduleIds": ["m3", "m1", "m2"]}


def test_module_reorder_events_uses_its_own_body_key(stub_bluz, run_cli):
    stub = stub_bluz()
    stub.envelope("POST", "/api/gantt/modules/m-1/reorder-events", None)

    result = run_cli(stub, "gantt", "modules", "reorder-events", "m-1", "e2,e1")

    assert result.exit_code == 0
    assert stub.last().body == {"eventIds": ["e2", "e1"]}


# --- curriculum export / import ------------------------------------------------


def test_curriculum_export_writes_json_to_the_output_file(stub_bluz, tmp_path, run_cli):
    stub = stub_bluz()
    tree = {"curriculum": {"id": "c-1"}, "mappings": []}
    stub.envelope("GET", "/api/gantt/curriculums/c-1/export", tree)
    out = tmp_path / "tree.json"

    result = run_cli(stub, "gantt", "curriculums", "export", "c-1", "-o", str(out))

    assert result.exit_code == 0
    assert json.loads(out.read_text(encoding="utf-8")) == tree


def test_curriculum_export_excel_downloads_raw_bytes(tmp_path, stub_bluz, run_cli):
    """The .xlsx route answers a byte stream, not the JSON envelope."""
    stub = stub_bluz()
    workbook = b"PK\x03\x04-fake-xlsx-bytes"
    stub.route(
        "GET",
        "/api/gantt/curriculums/c-1/export/excel",
        Raw(
            workbook,
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ),
    )
    out = tmp_path / "plan.xlsx"

    result = run_cli(
        stub, "gantt", "curriculums", "export-excel", "c-1", "-o", str(out)
    )

    assert result.exit_code == 0
    assert out.read_bytes() == workbook


def test_curriculum_import_posts_the_export_file_contents(stub_bluz, tmp_path, run_cli):
    stub = stub_bluz()
    stub.envelope("POST", "/api/gantt/curriculums/import", {"id": "c-new"})
    source = tmp_path / "export.json"
    source.write_text('{"curriculum": {"id": "c-1"}}', encoding="utf-8")

    result = run_cli(stub, "gantt", "curriculums", "import", str(source))

    assert result.exit_code == 0
    assert stub.last().method == "POST"
    assert stub.last().body == {"curriculum": {"id": "c-1"}}


# --- mappings (cMDA) ------------------------------------------------------------


def test_curriculum_constraints_scope_through_the_query(stub_bluz, run_cli):
    stub = stub_bluz()
    stub.envelope("GET", "/api/gantt/curriculums/c-1/constraints", [])

    result = run_cli(
        stub,
        "gantt",
        "curriculums",
        "constraints",
        "c-1",
        "--syllabus-id",
        "s-1",
        "--module-id",
        "m-1",
    )

    assert result.exit_code == 0
    assert stub.last().query == {"syllabusId": ["s-1"], "moduleId": ["m-1"]}


def test_curriculum_mappings_lists_the_table(stub_bluz, run_cli):
    stub = stub_bluz()
    stub.envelope("GET", "/api/gantt/curriculums/c-1/mappings", [{"dayId": "d-1"}])

    result = run_cli(stub, "gantt", "curriculums", "mappings", "c-1")

    assert result.exit_code == 0
    assert stub.last().path == "/api/gantt/curriculums/c-1/mappings"


def test_set_mapping_places_a_module_on_a_day(stub_bluz, run_cli):
    stub = stub_bluz()
    stub.envelope("POST", "/api/gantt/curriculums/c-1/mappings", {"ok": True})

    result = run_cli(
        stub,
        "gantt",
        "curriculums",
        "set-mapping",
        "c-1",
        "--module-id",
        "m-1",
        "--day-id",
        "d-1",
        "--sort-order",
        "2.5",
    )

    assert result.exit_code == 0
    assert stub.last().body == {
        "moduleId": "m-1",
        "dayId": "d-1",
        "sortOrder": 2.5,
    }


def test_set_mapping_can_target_an_event_instead_of_the_module(stub_bluz, run_cli):
    stub = stub_bluz()
    stub.envelope("POST", "/api/gantt/curriculums/c-1/mappings", {"ok": True})

    result = run_cli(
        stub,
        "gantt",
        "curriculums",
        "set-mapping",
        "c-1",
        "--module-id",
        "m-1",
        "--day-id",
        "d-1",
        "--event-id",
        "e-1",
    )

    assert result.exit_code == 0
    assert stub.last().body == {"moduleId": "m-1", "dayId": "d-1", "eventId": "e-1"}


def test_move_mapping_patches_old_mapping_and_new_values(stub_bluz, run_cli):
    """The route reads oldMapping/newValues; eventId rides along even when null."""
    stub = stub_bluz()
    stub.envelope("PATCH", "/api/gantt/curriculums/c-1/mappings", {"ok": True})

    result = run_cli(
        stub,
        "gantt",
        "curriculums",
        "move-mapping",
        "c-1",
        "--module-id",
        "m-1",
        "--old-day-id",
        "d-1",
        "--new-day-id",
        "d-2",
    )

    assert result.exit_code == 0
    assert stub.last().method == "PATCH"
    assert stub.last().body == {
        "moduleId": "m-1",
        "eventId": None,
        "oldMapping": {"dayId": "d-1"},
        "newValues": {"dayId": "d-2"},
    }


def test_move_mapping_demands_at_least_one_new_value(stub_bluz, run_cli):
    stub = stub_bluz()

    result = run_cli(
        stub,
        "gantt",
        "curriculums",
        "move-mapping",
        "c-1",
        "--module-id",
        "m-1",
        "--old-day-id",
        "d-1",
    )

    assert result.exit_code != 0
    assert not stub.requests


def test_unset_mapping_deletes_with_the_identifying_body(stub_bluz, run_cli):
    stub = stub_bluz()
    stub.envelope("DELETE", "/api/gantt/curriculums/c-1/mappings", None)

    result = run_cli(
        stub,
        "gantt",
        "curriculums",
        "unset-mapping",
        "c-1",
        "--module-id",
        "m-1",
        "--day-id",
        "d-1",
        "--event-id",
        "e-1",
    )

    assert result.exit_code == 0
    assert stub.last().method == "DELETE"
    assert stub.last().body == {"moduleId": "m-1", "eventId": "e-1", "dayId": "d-1"}


# --- duplicate / cut lifecycle --------------------------------------------------


def test_duplicate_defaults_to_an_empty_overrides_object(stub_bluz, run_cli):
    stub = stub_bluz()
    stub.envelope("POST", "/api/gantt/curriculums/c-1/duplicate", {"id": "c-copy"})

    result = run_cli(stub, "gantt", "curriculums", "duplicate", "c-1")

    assert result.exit_code == 0
    assert stub.last().body == {}


def test_duplicate_forwards_overrides_verbatim(stub_bluz, run_cli):
    stub = stub_bluz()
    stub.envelope("POST", "/api/gantt/curriculums/c-1/duplicate", {"id": "c-copy"})

    result = run_cli(
        stub,
        "gantt",
        "curriculums",
        "duplicate",
        "c-1",
        "--overrides",
        '{"title": "Copy"}',
    )

    assert result.exit_code == 0
    assert stub.last().body == {"title": "Copy"}


def test_cut_status_reads_the_cut_route(stub_bluz, run_cli):
    stub = stub_bluz()
    stub.envelope("GET", "/api/gantt/curriculums/c-1/cut", {"hasCutEvents": False})

    result = run_cli(stub, "gantt", "curriculums", "cut-status", "c-1")

    assert result.exit_code == 0
    assert stub.last().method == "GET"


def test_cut_preview_is_a_bodyless_get(stub_bluz, run_cli):
    stub = stub_bluz()
    stub.envelope("GET", "/api/gantt/curriculums/c-1/cut/preview", {"occurrences": []})

    result = run_cli(stub, "gantt", "curriculums", "cut-preview", "c-1")

    assert result.exit_code == 0
    assert stub.last().method == "GET"
    assert stub.last().body is None


def test_pull_back_deletes_the_cut_route(stub_bluz, run_cli):
    stub = stub_bluz()
    stub.envelope("DELETE", "/api/gantt/curriculums/c-1/cut", {"deleted": 4})

    result = run_cli(stub, "gantt", "curriculums", "pull-back", "c-1", "--yes")

    assert result.exit_code == 0
    assert stub.last().method == "DELETE"
    assert stub.last().path == "/api/gantt/curriculums/c-1/cut"


def test_execution_compares_plan_against_events(stub_bluz, run_cli):
    stub = stub_bluz()
    stub.envelope("GET", "/api/gantt/curriculums/c-1/execution", {"events": {}})

    result = run_cli(stub, "gantt", "curriculums", "execution", "c-1")

    assert result.exit_code == 0
    assert stub.last().path == "/api/gantt/curriculums/c-1/execution"


def test_recurrence_exceptions_are_listed_per_curriculum(stub_bluz, run_cli):
    stub = stub_bluz()
    stub.envelope("GET", "/api/gantt/curriculums/c-1/recurrence-exceptions", [])

    result = run_cli(stub, "gantt", "curriculums", "recurrence-exceptions", "c-1")

    assert result.exit_code == 0
    assert stub.last().method == "GET"


# --- gantt event extras ----------------------------------------------------------


def test_event_duplicate_names_the_target_module(stub_bluz, run_cli):
    stub = stub_bluz()
    stub.envelope("POST", "/api/gantt/events/e-1/duplicate", {"id": "e-copy"})

    result = run_cli(stub, "gantt", "events", "duplicate", "e-1", "--module-id", "m-2")

    assert result.exit_code == 0
    assert stub.last().body == {"moduleId": "m-2"}


def test_except_occurrence_drops_one_day(stub_bluz, run_cli):
    stub = stub_bluz()
    stub.envelope("POST", "/api/gantt/events/e-1/recurrence-exceptions", {"ok": True})

    result = run_cli(
        stub,
        "gantt",
        "events",
        "except-occurrence",
        "e-1",
        "--curriculum-id",
        "c-1",
        "--day-id",
        "d-7",
    )

    assert result.exit_code == 0
    assert stub.last().body == {"curriculumId": "c-1", "dayId": "d-7"}


def test_materialize_posts_curriculum_module_and_day(stub_bluz, run_cli):
    stub = stub_bluz()
    stub.envelope("POST", "/api/gantt/events/e-1/materialize", {"id": "e-new"})

    result = run_cli(
        stub,
        "gantt",
        "events",
        "materialize",
        "e-1",
        "--curriculum-id",
        "c-1",
        "--module-id",
        "m-1",
        "--day-id",
        "d-3",
    )

    assert result.exit_code == 0
    assert stub.last().body == {
        "curriculumId": "c-1",
        "moduleId": "m-1",
        "dayId": "d-3",
    }


def test_recreate_occurrence_posts_the_event_and_its_date(stub_bluz, run_cli):
    stub = stub_bluz()
    stub.envelope(
        "POST", "/api/gantt/curriculums/c-1/execution/recreate", {"id": "ev-9"}
    )

    result = run_cli(
        stub,
        "gantt",
        "curriculums",
        "recreate-occurrence",
        "c-1",
        "--gantt-event-id",
        "ge-1",
        "--date",
        "2026-03-04T08:00:00Z",
    )

    assert result.exit_code == 0
    assert stub.last().body == {
        "ganttEventId": "ge-1",
        "occurrenceDate": "2026-03-04T08:00:00Z",
    }


def test_shuffle_group_posts_the_module_and_split_names(stub_bluz, run_cli):
    stub = stub_bluz()
    stub.envelope("POST", "/api/gantt/events/e-1/shuffle-group", [])

    result = run_cli(
        stub,
        "gantt",
        "events",
        "shuffle-group",
        "e-1",
        "--module-id",
        "m-1",
        "--shuffles",
        "א, ב ,ג",
    )

    assert result.exit_code == 0
    assert stub.last().body == {"moduleId": "m-1", "shuffles": ["א", "ב", "ג"]}


def test_shuffle_group_with_no_names_ungroups(stub_bluz, run_cli):
    stub = stub_bluz()
    stub.envelope("POST", "/api/gantt/events/e-1/shuffle-group", [])

    result = run_cli(
        stub,
        "gantt",
        "events",
        "shuffle-group",
        "e-1",
        "--module-id",
        "m-1",
        "--shuffles",
        "",
    )

    assert result.exit_code == 0
    assert stub.last().body == {"moduleId": "m-1", "shuffles": []}
