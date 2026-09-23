"""
Name: test_resource_requests.py
Purpose: Wire contracts for the directory-style command families — rooms,
         courses, reservations, outsiders and custom colours. These share the
         bulk-collection shape (PUT/POST/DELETE on one collection path, ids as
         JSON bodies), so each contract is pinned exactly.
Created: 2026-08-23
Author: Michael K. Steinberg
"""

from __future__ import annotations

# --- bluz rooms ------------------------------------------------------------------


def test_rooms_list_hits_the_collection(stub_bluz, run_cli):
    stub = stub_bluz()
    stub.envelope("GET", "/api/rooms", [])

    result = run_cli(stub, "rooms", "list")

    assert result.exit_code == 0
    assert stub.last().method == "GET"


def test_rooms_get_filters_the_collection_client_side(stub_bluz, run_cli):
    """There is no per-id route — `get` narrows the bulk list locally."""
    stub = stub_bluz()
    stub.envelope(
        "GET",
        "/api/rooms",
        [{"id": "r-1", "name": "One"}, {"id": "r-2", "name": "Two"}],
    )

    result = run_cli(stub, "rooms", "get", "r-2")

    assert result.exit_code == 0
    # Exactly one request was made: the bulk list.
    assert len(stub.requests) == 1
    assert stub.last().path == "/api/rooms"


def test_room_create_puts_a_custom_sourced_record(stub_bluz, run_cli):
    stub = stub_bluz()
    stub.envelope("PUT", "/api/rooms", {"ok": True})

    result = run_cli(stub, "rooms", "create", "--name", "Hall", "--id", "r-fixed")

    assert result.exit_code == 0
    assert stub.last().method == "PUT"
    # RoomSource.Custom = 0; description rides along only when given.
    assert stub.last().body == {"id": "r-fixed", "name": "Hall", "source": 0}


def test_room_create_carries_the_description_when_given(stub_bluz, run_cli):
    stub = stub_bluz()
    stub.envelope("PUT", "/api/rooms", {"ok": True})

    import uuid

    result = run_cli(stub, "rooms", "create", "--name", "Hall", "--description", "Big")

    assert result.exit_code == 0
    body = stub.last().body
    assert body["name"] == "Hall"
    assert body["description"] == "Big"
    # The id was minted client-side as a UUID.
    uuid.UUID(body["id"])


def test_room_update_posts_id_name_and_source(stub_bluz, run_cli):
    stub = stub_bluz()
    stub.envelope("POST", "/api/rooms", {"ok": True})

    result = run_cli(stub, "rooms", "update", "r-1", "--name", "Renamed")

    assert result.exit_code == 0
    assert stub.last().method == "POST"
    assert stub.last().body == {
        "id": "r-1",
        "name": "Renamed",
        "source": 0,
    }


def test_room_delete_sends_the_id_as_a_json_string_body(stub_bluz, run_cli):
    stub = stub_bluz()
    stub.envelope("DELETE", "/api/rooms", None)

    result = run_cli(stub, "rooms", "delete", "r-1", "--yes")

    assert result.exit_code == 0
    assert stub.last().method == "DELETE"
    assert stub.last().body == "r-1"


def test_room_set_info_patches_extended_info_with_the_source(stub_bluz, run_cli):
    stub = stub_bluz()
    stub.envelope("PATCH", "/api/rooms", None)

    result = run_cli(
        stub,
        "rooms",
        "set-info",
        "r-hive",
        "--source",
        "1",
        "--info",
        '{"workstationCount": 20}',
    )

    assert result.exit_code == 0
    assert stub.last().method == "PATCH"
    assert stub.last().body == {
        "roomId": "r-hive",
        "roomSource": 1,
        "extendedInfo": {"workstationCount": 20},
    }


# --- bluz courses -----------------------------------------------------------------


def test_course_create_puts_every_field_it_was_given(stub_bluz, run_cli):
    stub = stub_bluz()
    stub.envelope("PUT", "/api/course", {"ok": True})

    result = run_cli(
        stub,
        "courses",
        "create",
        "--name",
        "Math",
        "--color",
        "#2196f3",
        "--parent-id",
        "c-root",
        "--instructor-ids",
        '["i1", "i2"]',
        "--id",
        "co-9",
    )

    assert result.exit_code == 0
    assert stub.last().method == "PUT"
    assert stub.last().body == {
        "id": "co-9",
        "name": "Math",
        "color": "#2196f3",
        "parentId": "c-root",
        "instructorIds": ["i1", "i2"],
    }


def test_courses_get_filters_the_collection_client_side(stub_bluz, run_cli):
    stub = stub_bluz()
    stub.envelope("GET", "/api/course", [{"id": "c-1"}, {"id": "c-2"}])

    result = run_cli(stub, "courses", "get", "c-2")

    assert result.exit_code == 0
    assert len(stub.requests) == 1


def test_course_update_posts_only_the_fields_it_was_given(stub_bluz, run_cli):
    stub = stub_bluz()
    stub.envelope("POST", "/api/course", {"ok": True})

    result = run_cli(stub, "courses", "update", "c-1", "--color", "#000000")

    assert result.exit_code == 0
    assert stub.last().method == "POST"
    assert stub.last().body == {"id": "c-1", "color": "#000000"}


def test_course_delete_sends_the_id_as_a_json_string_body(stub_bluz, run_cli):
    stub = stub_bluz()
    stub.envelope("DELETE", "/api/course", None)

    result = run_cli(stub, "courses", "delete", "c-1", "--yes")

    assert result.exit_code == 0
    assert stub.last().body == "c-1"


# --- bluz outsiders -----------------------------------------------------------------


def test_outsider_create_pins_required_and_dropped_optional_fields(stub_bluz, run_cli):
    stub = stub_bluz()
    stub.envelope("PUT", "/api/outsiders", {"ok": True})

    result = run_cli(
        stub,
        "outsiders",
        "create",
        "--name",
        "Jane Roe",
        "--phone",
        "054-1234567",
        "--personal-number",
        "1234567",
    )

    assert result.exit_code == 0
    body = stub.last().body
    # Optional fields the user omitted must not appear at all.
    assert body == {
        "id": body["id"],
        "name": "Jane Roe",
        "phone": "054-1234567",
        "personalNumber": "1234567",
    }
    assert body["id"].startswith("outsider-")


def test_outsider_create_honours_an_explicit_id(stub_bluz, run_cli):
    stub = stub_bluz()
    stub.envelope("PUT", "/api/outsiders", {"ok": True})

    result = run_cli(
        stub,
        "outsiders",
        "create",
        "--name",
        "Jane Roe",
        "--phone",
        "054-1234567",
        "--id",
        "out-fixed",
        "--release-date",
        "2026-09-01",
        "--comment",
        "note",
        "--id-number",
        "123456789",
    )

    assert result.exit_code == 0
    # merge_fields drops the optional fields that were not passed.
    assert stub.last().body == {
        "id": "out-fixed",
        "name": "Jane Roe",
        "phone": "054-1234567",
        "idNumber": "123456789",
        "releaseDate": "2026-09-01",
        "comment": "note",
    }
    assert stub.last().method == "PUT"


def test_outsider_update_posts_only_changed_fields(stub_bluz, run_cli):
    stub = stub_bluz()
    stub.envelope("POST", "/api/outsiders", {"ok": True})

    result = run_cli(stub, "outsiders", "update", "o-1", "--phone", "050-9999999")

    assert result.exit_code == 0
    assert stub.last().method == "POST"
    assert stub.last().body == {"id": "o-1", "phone": "050-9999999"}


def test_outsider_delete_sends_the_id_as_a_json_string_body(stub_bluz, run_cli):
    stub = stub_bluz()
    stub.envelope("DELETE", "/api/outsiders", None)

    result = run_cli(stub, "outsiders", "delete", "o-1", "--yes")

    assert result.exit_code == 0
    assert stub.last().body == "o-1"


def test_outsiders_get_filters_the_collection_client_side(stub_bluz, run_cli):
    stub = stub_bluz()
    stub.envelope("GET", "/api/outsiders", [{"id": "o-1", "name": "Jane"}])

    result = run_cli(stub, "outsiders", "get", "o-1")

    assert result.exit_code == 0
    assert len(stub.requests) == 1


# --- bluz reservations ---------------------------------------------------------------


def test_reservation_list_forwards_every_filter_as_a_query_param(stub_bluz, run_cli):
    stub = stub_bluz()
    stub.envelope("GET", "/api/reservations", [])

    result = run_cli(
        stub,
        "reservations",
        "list",
        "--room-id",
        "r-1",
        "--room-source",
        "1",
        "--from",
        "2026-08-01T00:00:00Z",
        "--to",
        "2026-08-31T23:59:59Z",
    )

    assert result.exit_code == 0
    assert stub.last().query == {
        "roomId": ["r-1"],
        "roomSource": ["1"],
        "from": ["2026-08-01T00:00:00Z"],
        "to": ["2026-08-31T23:59:59Z"],
    }


def test_reservations_get_makes_one_unparameterised_request(stub_bluz, run_cli):
    """No per-id route: the bulk list is filtered by _id client-side."""
    stub = stub_bluz()
    stub.envelope("GET", "/api/reservations", [{"_id": "res-1"}, {"_id": "res-2"}])

    result = run_cli(stub, "reservations", "get", "res-2")

    assert result.exit_code == 0
    assert len(stub.requests) == 1
    assert stub.last().query == {}


def test_reservation_create_puts_the_full_payload_including_note(stub_bluz, run_cli):
    stub = stub_bluz()
    stub.envelope("PUT", "/api/reservations", {"ok": True})

    result = run_cli(
        stub,
        "reservations",
        "create",
        "--room-id",
        "r-1",
        "--room-source",
        "0",
        "--start",
        "2026-08-24T09:00:00Z",
        "--end",
        "2026-08-24T10:00:00Z",
        "--reserver-type",
        "instructor",
        "--reserver-id",
        "i-1",
        "--note",
        "projector",
    )

    assert result.exit_code == 0
    assert stub.last().method == "PUT"
    assert stub.last().body == {
        "roomId": "r-1",
        "roomSource": 0,
        "start": "2026-08-24T09:00:00Z",
        "end": "2026-08-24T10:00:00Z",
        "reserverType": "instructor",
        "reserverId": "i-1",
        "note": "projector",
    }


def test_reservation_cancel_deletes_through_a_string_body(stub_bluz, run_cli):
    stub = stub_bluz()
    stub.envelope("DELETE", "/api/reservations", None)

    result = run_cli(stub, "reservations", "cancel", "res-1", "--yes")

    assert result.exit_code == 0
    assert stub.last().method == "DELETE"
    assert stub.last().body == "res-1"


# --- bluz colors -----------------------------------------------------------------------


def test_color_create_puts_an_explicitly_keyed_record(stub_bluz, run_cli):
    stub = stub_bluz()
    stub.envelope("PUT", "/api/custom-colors", {"ok": True})

    result = run_cli(
        stub, "colors", "create", "--name", "Focus", "--hex", "#3f51b5", "--id", "col-1"
    )

    assert result.exit_code == 0
    assert stub.last().method == "PUT"
    assert stub.last().body == {"id": "col-1", "name": "Focus", "hex": "#3f51b5"}


def test_color_update_carries_unset_fields_over_from_the_current_value(
    stub_bluz, run_cli
):
    """The server replaces the whole record, so the CLI merges before posting."""
    stub = stub_bluz()
    stub.envelope(
        "GET", "/api/custom-colors", [{"id": "col-1", "name": "Old", "hex": "#111111"}]
    )
    stub.envelope("POST", "/api/custom-colors", {"ok": True})

    result = run_cli(stub, "colors", "update", "col-1", "--name", "New")

    assert result.exit_code == 0
    # Two requests: read current, then post the merged record.
    assert len(stub.requests) == 2
    assert stub.last().method == "POST"
    assert stub.last().body == {"id": "col-1", "name": "New", "hex": "#111111"}


def test_colors_get_filters_the_collection_client_side(stub_bluz, run_cli):
    stub = stub_bluz()
    stub.envelope("GET", "/api/custom-colors", [{"id": "col-1", "name": "Focus"}])

    result = run_cli(stub, "colors", "get", "col-1")

    assert result.exit_code == 0
    assert len(stub.requests) == 1


def test_color_delete_sends_the_id_as_a_json_string_body(stub_bluz, run_cli):
    stub = stub_bluz()
    stub.envelope("DELETE", "/api/custom-colors", None)

    result = run_cli(stub, "colors", "delete", "col-1", "--yes")

    assert result.exit_code == 0
    assert stub.last().body == "col-1"
