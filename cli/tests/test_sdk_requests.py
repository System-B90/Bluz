"""
Name: test_sdk_requests.py
Purpose: Wire contracts for the Python SDK — each `bz.<namespace>` method and
         each model action puts exactly the expected request on the wire, and
         parses what comes back into the right model.
Created: 2026-10-02
Author: Michael K. Steinberg
"""

from __future__ import annotations

from datetime import UTC, date, datetime

import pytest
from bluz import Bluz, BluzApiError, NotAuthenticatedError, NotFoundError
from bluz.models import (
    CalendarSnapshot,
    Course,
    Curriculum,
    CutResult,
    Event,
    GanttSummary,
    HealthReport,
    Iteration,
    Module,
    Room,
    RoomExtendedInfo,
    RoomSource,
    ScheduleSettings,
)
from wire_types import Raw

ROOMS = [
    {"id": "r-1", "name": "Lab", "source": 0},
    {"id": 7, "name": "Hall", "source": 1, "display_name": "Hall"},
]
COURSES = [
    {"id": "root", "name": "Bis90", "color": None},
    {"id": "apollo", "name": "Apollo", "color": "#fff", "parentId": "root"},
    {"id": "a1", "name": "Apollo 1", "color": None, "parentId": "apollo"},
]
EVENT = {
    "id": "ev-1",
    "name": "Algebra",
    "startTime": "2026-11-01T06:00:00.000Z",
    "endTime": "2026-11-01T07:00:00.000Z",
    "courses": ["a1"],
    "rooms": [{"id": "r-1", "source": 0}],
    "ganttEventId": "e1",
    "ganttCurriculumId": "c1",
}
TREE = {
    "id": "c1",
    "title": "Bis90",
    "isDraft": False,
    "c2s": [
        {
            "syllabus": {
                "id": "s1",
                "title": "Math",
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
                                        "type": "הרצאה",
                                        "minimumDuration": 45,
                                        "cEC": [
                                            {
                                                "curriculumId": "c1",
                                                "allocatedDuration": 60,
                                            }
                                        ],
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


# --- session ------------------------------------------------------------------


def test_session_sends_the_token_cookie_and_unwraps_the_envelope(stub_bluz, sdk):
    stub = stub_bluz()
    stub.envelope("GET", "/api/iterations/current", {"id": "2026b", "isCurrent": True})

    current = sdk(stub).iterations.current()

    assert isinstance(current, Iteration)
    assert current.is_current is True


def test_session_repr_names_url_and_scope(stub_bluz, sdk):
    stub = stub_bluz()
    bz = sdk(stub)
    assert repr(bz) == f"<Bluz {stub.url} iteration=current>"
    assert "iteration=2026a" in repr(bz.scoped("2026a"))


def test_scoped_session_sends_the_iteration_by_default(stub_bluz, sdk):
    stub = stub_bluz()
    stub.envelope("GET", "/api/course", COURSES)

    sdk(stub).scoped("2026a").courses.list()

    assert stub.last().query == {"it": ["2026a"]}


def test_explicit_iteration_beats_the_session_default(stub_bluz, sdk):
    stub = stub_bluz()
    stub.envelope("GET", "/api/course", COURSES)

    sdk(stub, iteration="2026a").courses.list(iteration="2026b")

    assert stub.last().query == {"it": ["2026b"]}


def test_scoping_by_iteration_object(stub_bluz, sdk):
    stub = stub_bluz()
    stub.envelope("GET", "/api/course", [])
    bz = sdk(stub)

    Iteration.from_wire({"id": "2025b"}, bz).scoped().courses.list()

    assert stub.last().query == {"it": ["2025b"]}


def test_errors_surface_as_bluz_api_error(stub_bluz, sdk):
    stub = stub_bluz()
    stub.route(
        "GET",
        "/api/iterations/nope",
        {"status": -1, "error": {"name": "ClientApiError", "message": "לא נמצא"}},
        status=400,
    )

    with pytest.raises(BluzApiError) as info:
        sdk(stub).iterations.get("nope")

    assert info.value.error_name == "ClientApiError"
    assert info.value.http_status == 400


def test_unauthorised_is_not_authenticated(stub_bluz, sdk):
    stub = stub_bluz()
    stub.route("GET", "/api/rooms", {}, status=401)

    with pytest.raises(NotAuthenticatedError):
        sdk(stub).rooms.list()


def test_http_escape_hatch(stub_bluz, sdk):
    stub = stub_bluz()
    stub.envelope("GET", "/api/anything", {"x": 1})

    assert sdk(stub).http.get("/api/anything") == {"x": 1}


# --- rooms ------------------------------------------------------------------------


def test_rooms_list_parses_both_sources(stub_bluz, sdk):
    stub = stub_bluz()
    stub.envelope("GET", "/api/rooms", ROOMS)

    rooms = sdk(stub).rooms.list()

    assert [type(r) for r in rooms] == [Room, Room]
    assert rooms["Hall"].source is RoomSource.HIVE
    assert rooms["Hall"].display_name == "Hall"  # unknown field kept


def test_rooms_get_and_lookup(stub_bluz, sdk):
    stub = stub_bluz()
    stub.envelope("GET", "/api/rooms", ROOMS)
    bz = sdk(stub)

    assert bz.rooms.get(7).name == "Hall"
    assert bz.rooms["Lab"].id == "r-1"
    with pytest.raises(NotFoundError):
        bz.rooms.get("missing")


def test_room_create_puts_a_custom_room(stub_bluz, sdk):
    stub = stub_bluz()
    stub.envelope("PUT", "/api/rooms", {"id": "x", "name": "New", "source": 0})

    room = sdk(stub).rooms.create("New", description="d", room_id="x")

    assert stub.last().body == {
        "id": "x",
        "name": "New",
        "source": 0,
        "description": "d",
    }
    assert room.is_custom


def test_room_object_actions(stub_bluz, sdk):
    stub = stub_bluz()
    stub.envelope("GET", "/api/rooms", ROOMS)
    stub.envelope("POST", "/api/rooms", {"id": "r-1", "name": "Lab 2", "source": 0})
    stub.envelope("DELETE", "/api/rooms", None)
    stub.envelope("PATCH", "/api/rooms", None)
    room = sdk(stub).rooms["Lab"]

    assert room.update(name="Lab 2").name == "Lab 2"
    assert stub.last().body == {"id": "r-1", "name": "Lab 2", "source": 0}

    room.set_extended_info(RoomExtendedInfo(workstation_count=20))
    assert stub.last().body == {
        "roomId": "r-1",
        "roomSource": 0,
        "extendedInfo": {"workstationCount": 20},
    }

    room.delete()
    assert (stub.last().method, stub.last().body) == ("DELETE", "r-1")


def test_room_reservations_filter_by_room_and_dates(stub_bluz, sdk):
    stub = stub_bluz()
    stub.envelope("GET", "/api/rooms", ROOMS)
    stub.envelope("GET", "/api/reservations", [])
    room = sdk(stub).rooms["Hall"]

    room.reservations(start=date(2026, 11, 1), end="2026-11-08")

    assert stub.last().query == {
        "roomId": ["7"],
        "roomSource": ["1"],
        "from": ["2026-11-01"],
        "to": ["2026-11-08"],
    }


# --- courses -------------------------------------------------------------------------


def test_course_tree_navigation(stub_bluz, sdk):
    stub = stub_bluz()
    stub.envelope("GET", "/api/course", COURSES)
    bz = sdk(stub)

    apollo = bz.courses["Apollo"]

    assert apollo.parent.name == "Bis90"
    assert [c.id for c in apollo.children] == ["a1"]
    assert bz.courses.roots().ids == ["root"]


def test_course_create_accepts_a_parent_object(stub_bluz, sdk):
    stub = stub_bluz()
    stub.envelope("PUT", "/api/course", {"id": "k", "name": "New"})
    parent = Course(id="apollo", name="Apollo")

    sdk(stub).courses.create("New", parent=parent, course_id="k", instructor_ids=[1])

    assert stub.last().body == {
        "id": "k",
        "name": "New",
        "parentId": "apollo",
        "instructorIds": [1],
    }


# --- outsiders / colours / reservations ------------------------------------------


def test_outsider_create_and_update(stub_bluz, sdk):
    stub = stub_bluz()
    stub.envelope("PUT", "/api/outsiders", {"id": "o", "name": "Dana", "phone": "1"})
    stub.envelope("POST", "/api/outsiders", {"id": "o", "name": "Dana", "phone": "2"})
    bz = sdk(stub)

    outsider = bz.outsiders.create("Dana", "1", outsider_id="o", comment="vip")
    assert stub.last().body == {
        "id": "o",
        "name": "Dana",
        "phone": "1",
        "comment": "vip",
    }

    outsider.update(phone="2")
    assert stub.last().body == {"id": "o", "phone": "2"}


def test_colour_update_carries_unset_fields(stub_bluz, sdk):
    stub = stub_bluz()
    stub.envelope(
        "GET", "/api/custom-colors", [{"id": "c", "name": "Red", "hex": "#f00"}]
    )
    stub.envelope(
        "POST", "/api/custom-colors", {"id": "c", "name": "Red", "hex": "#e00"}
    )

    sdk(stub).colors.update("c", hex="#e00")

    assert stub.last().body == {"id": "c", "name": "Red", "hex": "#e00"}


def test_reservation_create_from_room_object_and_datetimes(stub_bluz, sdk):
    stub = stub_bluz()
    stub.envelope(
        "PUT",
        "/api/reservations",
        {
            "_id": "res",
            "roomId": 7,
            "roomSource": 1,
            "start": "2026-11-01T08:00:00Z",
            "end": "2026-11-01T10:00:00Z",
            "reserverType": "outsider",
            "reserverId": "o",
        },
    )
    room = Room(id=7, name="Hall", source=RoomSource.HIVE)

    sdk(stub).reservations.create(
        room,
        datetime(2026, 11, 1, 8, tzinfo=UTC),
        datetime(2026, 11, 1, 10, tzinfo=UTC),
        reserver_type="outsider",
        reserver_id="o",
    )

    assert stub.last().body == {
        "roomId": 7,
        "roomSource": 1,
        "start": "2026-11-01T08:00:00+00:00",
        "end": "2026-11-01T10:00:00+00:00",
        "reserverType": "outsider",
        "reserverId": "o",
    }


def test_reservation_cancel_from_object(stub_bluz, sdk):
    stub = stub_bluz()
    stub.envelope(
        "GET",
        "/api/reservations",
        [
            {
                "_id": "res",
                "roomId": 7,
                "roomSource": 1,
                "start": "2026-11-01T08:00:00Z",
                "end": "2026-11-01T09:00:00Z",
                "reserverType": "instructor",
                "reserverId": "12",
            }
        ],
    )
    stub.envelope("DELETE", "/api/reservations", None)
    bz = sdk(stub)

    bz.reservations.get("res").cancel()

    assert stub.last().body == "res"


# --- iterations ---------------------------------------------------------------------


def test_iteration_patch_and_set_current(stub_bluz, sdk):
    stub = stub_bluz()
    stub.envelope("PATCH", "/api/iterations/2026a", {"id": "2026a", "isCurrent": True})
    bz = sdk(stub)

    bz.iterations.patch("2026a", label="A", start_date=date(2026, 1, 1))
    assert stub.last().body == {"label": "A", "startDate": "2026-01-01"}

    bz.iterations.set_current("2026a")
    assert stub.last().body == {"isCurrent": True}


def test_iteration_patch_can_send_an_explicit_null(stub_bluz, sdk):
    stub = stub_bluz()
    stub.envelope("PATCH", "/api/iterations/2026a", {"id": "2026a"})

    sdk(stub).iterations.patch("2026a", {"ganttCurriculumId": None})

    assert stub.last().body == {"ganttCurriculumId": None}


def test_iteration_usage_defaults_to_current(stub_bluz, sdk):
    stub = stub_bluz()
    stub.envelope("GET", "/api/iterations/current/usage", {"orphaned": True})

    assert sdk(stub).iterations.usage().orphaned is True


def test_iteration_curriculum_follows_the_link(stub_bluz, sdk):
    stub = stub_bluz()
    stub.envelope(
        "GET", "/api/iterations/current", {"id": "x", "ganttCurriculumId": "c1"}
    )
    stub.envelope("GET", "/api/gantt/curriculums/c1", TREE)

    curriculum = sdk(stub).iterations.current().curriculum

    assert isinstance(curriculum, Curriculum)
    assert curriculum.title == "Bis90"


# --- events -------------------------------------------------------------------------


def test_events_list_accepts_dates(stub_bluz, sdk):
    stub = stub_bluz()
    stub.envelope("GET", "/api/event", [EVENT])

    events = sdk(stub).events.list(date(2026, 11, 1), "2026-11-02")

    assert stub.last().query == {"sd": ["2026-11-01"], "ed": ["2026-11-02"]}
    assert isinstance(events[0], Event)
    assert events[0].start_time.tzinfo is not None


def test_events_get_joins_ids(stub_bluz, sdk):
    stub = stub_bluz()
    stub.envelope("GET", "/api/event", [EVENT])

    sdk(stub).events.get("a", "b")

    assert stub.last().query == {"ids": ["a,b"]}


def test_event_save_posts_the_full_wire_event(stub_bluz, sdk):
    stub = stub_bluz()
    stub.envelope("GET", "/api/event", [EVENT])
    stub.envelope("POST", "/api/event", {**EVENT, "notes": "moved"})
    event = sdk(stub).events.get("ev-1")[0]

    event.notes = "moved"
    event.save()

    body = stub.last().body
    assert body["notes"] == "moved"
    assert body["startTime"] == "2026-11-01T06:00:00Z"
    assert body["rooms"] == [{"id": "r-1", "source": 0}]


def test_event_navigation(stub_bluz, sdk):
    stub = stub_bluz()
    stub.envelope("GET", "/api/event", [EVENT])
    stub.envelope("GET", "/api/course", COURSES)
    stub.envelope("GET", "/api/gantt/curriculums/c1", TREE)
    stub.envelope("GET", "/api/event/history", [])
    event = sdk(stub).events.get("ev-1")[0]

    assert event.course_objects.ids == ["a1"]
    assert event.curriculum.title == "Bis90"
    assert event.history() == []
    assert stub.last().query == {"id": ["ev-1"]}


def test_export_ics_returns_bytes(stub_bluz, sdk):
    stub = stub_bluz()
    stub.route("GET", "/api/event/export/ics", Raw(b"BEGIN:VCALENDAR", "text/calendar"))

    assert sdk(stub).events.export_ics("2026-11-01", "2026-12-01").startswith(b"BEGIN")


# --- drafts & snapshots --------------------------------------------------------------


def test_draft_create_serialises_event_models(stub_bluz, sdk):
    stub = stub_bluz()
    stub.envelope("POST", "/api/calendar/drafts", {"id": "d", "label": "x"})
    event = Event.from_wire(EVENT)

    sdk(stub).drafts.create("x", [event])

    assert stub.last().body["events"][0]["id"] == "ev-1"


def test_draft_update_leaves_events_alone_when_omitted(stub_bluz, sdk):
    stub = stub_bluz()
    stub.envelope("PUT", "/api/calendar/drafts", {"id": "d", "label": "y"})

    sdk(stub).drafts.update("d", label="y")

    assert stub.last().body == {"id": "d", "label": "y"}


def test_snapshot_restore_from_summary(stub_bluz, sdk):
    stub = stub_bluz()
    stub.envelope(
        "GET", "/api/calendar/snapshots", [{"id": "s", "label": "x", "eventCount": 3}]
    )
    stub.envelope(
        "POST",
        "/api/calendar/snapshots/restore",
        {"restoredCount": 3, "removedCount": 1, "rangeStart": "2026-11-01T00:00:00Z"},
    )
    snapshot = sdk(stub).snapshots.list()[0]

    assert isinstance(snapshot, CalendarSnapshot)
    result = snapshot.restore()

    assert stub.last().query == {"id": ["s"]}
    assert result.restored_count == 3
    assert result.range_start == datetime(2026, 11, 1, tzinfo=UTC)


# --- gantt ----------------------------------------------------------------------------


def test_gantt_list_returns_summaries_that_fetch_the_full_item(stub_bluz, sdk):
    stub = stub_bluz()
    stub.envelope("GET", "/api/gantt/curriculums", {"c1": "Bis90"})
    stub.envelope("GET", "/api/gantt/curriculums/c1", TREE)

    rows = sdk(stub).gantt.curriculums.list()

    assert isinstance(rows[0], GanttSummary)
    assert rows["Bis90"].get().title == "Bis90"


def test_gantt_list_with_parents(stub_bluz, sdk):
    stub = stub_bluz()
    stub.envelope(
        "GET", "/api/gantt/modules", {"m1": {"title": "Alg", "syllabusId": "s1"}}
    )

    rows = sdk(stub).gantt.modules.list(with_parents=True)

    assert stub.last().query == {"withParents": ["1"]}
    assert rows[0].syllabusId == "s1"


def test_gantt_lookup_by_title_and_iteration(stub_bluz, sdk):
    stub = stub_bluz()
    stub.envelope("GET", "/api/gantt/curriculums", {"c1": "Bis90"})
    stub.envelope("GET", "/api/gantt/curriculums/c1", TREE)
    bz = sdk(stub)

    assert bz.gantt.curriculums["Bis90"].id == "c1"
    assert [c.title for c in bz.gantt.curriculums] == ["Bis90"]
    with pytest.raises(NotFoundError):
        bz.gantt.curriculums["Nope"]


def test_flat_module_loads_its_tree_on_first_iteration(stub_bluz, sdk):
    stub = stub_bluz()
    stub.envelope(
        "GET",
        "/api/gantt/modules",
        {"m1": {"id": "m1", "title": "A", "events": ["e1"]}},
    )
    stub.envelope(
        "GET",
        "/api/gantt/modules/m1",
        {"id": "m1", "title": "A", "m2e": [{"event": {"id": "e1", "title": "Intro"}}]},
    )
    module = sdk(stub).gantt.modules.get_many("m1")[0]

    assert isinstance(module, Module)
    assert [e.title for e in module] == ["Intro"]
    assert module.events[0].module is module


def test_create_event_in_module(stub_bluz, sdk):
    stub = stub_bluz()
    stub.envelope("GET", "/api/gantt/curriculums/c1", TREE)
    stub.envelope("POST", "/api/gantt/events", {"id": "e9", "title": "Quiz"})
    module = sdk(stub).gantt.curriculums.get("c1")["Math"]["Algebra"]

    created = module.create_event("Quiz", minimum_duration=30)

    assert stub.last().body == {
        "moduleId": "m1",
        "title": "Quiz",
        "type": "הרצאה",
        "minimumDuration": 30,
    }
    assert created.id == "e9"


def test_create_syllabus_and_module(stub_bluz, sdk):
    stub = stub_bluz()
    stub.envelope("GET", "/api/gantt/curriculums/c1", TREE)
    stub.envelope("POST", "/api/gantt/syllabuses", {"id": "s9", "title": "Bio"})
    stub.envelope("POST", "/api/gantt/modules", {"id": "m9", "title": "Cells"})
    curriculum = sdk(stub).gantt.curriculums.get("c1")

    syllabus = curriculum.create_syllabus("Bio", shuffles=["A"])
    assert stub.last().body == {
        "curriculumId": "c1",
        "title": "Bio",
        "shuffles": ["A"],
        "hiveIds": [],
    }

    syllabus.create_module("Cells")
    assert stub.last().body == {
        "syllabusId": "s9",
        "title": "Cells",
        "description": "",
        "hiveIds": [],
    }


def test_node_update_and_delete(stub_bluz, sdk):
    stub = stub_bluz()
    stub.envelope("GET", "/api/gantt/curriculums/c1", TREE)
    stub.envelope("PATCH", "/api/gantt/events/e1", {"id": "e1", "title": "Intro 2"})
    stub.envelope("DELETE", "/api/gantt/events/e1", None)
    event = sdk(stub).gantt.curriculums.get("c1").events[0]

    assert event.update(title="Intro 2", is_critical=True).title == "Intro 2"
    assert stub.last().body == {"title": "Intro 2", "isCritical": True}

    event.delete()
    assert stub.last().method == "DELETE"


def test_set_allocated_duration_uses_the_reached_curriculum(stub_bluz, sdk):
    stub = stub_bluz()
    stub.envelope("GET", "/api/gantt/curriculums/c1", TREE)
    stub.envelope("POST", "/api/gantt/events/e1/allocate-time", None)
    event = sdk(stub).gantt.curriculums.get("c1").events[0]

    event.set_allocated_duration(90)

    assert stub.last().body == {"containerId": "c1", "duration": 90}


def test_reorder_and_link(stub_bluz, sdk):
    stub = stub_bluz()
    stub.envelope("POST", "/api/gantt/syllabuses/s1/reorder-modules", None)
    stub.envelope("POST", "/api/gantt/modules/m1/link", {})
    stub.envelope("DELETE", "/api/gantt/modules/m1/link", None)
    bz = sdk(stub)

    bz.gantt.syllabuses.reorder("s1", [Module(id="m2"), "m1"])
    assert stub.last().body == {"moduleIds": ["m2", "m1"]}

    bz.gantt.modules.link("m1", "s2")
    assert stub.last().body == {"newParentId": "s2"}

    bz.gantt.modules.unlink("m1", "s1")
    assert stub.last().body == {"oldParentId": "s1"}


def test_cut_plan_and_cut_bodies(stub_bluz, sdk):
    stub = stub_bluz()
    stub.envelope(
        "POST", "/api/gantt/curriculums/c1/cut/plan", {"report": {"decisions": []}}
    )
    stub.envelope("POST", "/api/gantt/curriculums/c1/cut", {"createdEvents": 12})
    bz = sdk(stub)

    plan = bz.gantt.curriculums.cut_plan("c1", insert_breaks=False)
    assert plan.report == {"decisions": []}
    assert stub.last().body == {
        "force": False,
        "autoSpillover": True,
        "insertBreaks": False,
        "acceptedConstraintMoves": [],
        "weekOverflowResolutions": {},
    }

    result = bz.gantt.curriculums.cut("c1", accepted_constraint_moves=["x"])
    assert isinstance(result, CutResult)
    assert result.created_events == 12
    assert stub.last().body["acceptedConstraintMoves"] == ["x"]


def test_mappings_accept_objects(stub_bluz, sdk):
    stub = stub_bluz()
    stub.envelope("POST", "/api/gantt/curriculums/c1/mappings", {})
    stub.envelope("PATCH", "/api/gantt/curriculums/c1/mappings", {})
    bz = sdk(stub)

    bz.gantt.curriculums.set_mapping(
        Curriculum(id="c1"), Module(id="m1"), "d1", sort_order=2
    )
    assert stub.last().body == {"moduleId": "m1", "dayId": "d1", "sortOrder": 2}

    bz.gantt.curriculums.move_mapping("c1", "m1", "d1", new_day="d2")
    assert stub.last().body == {
        "moduleId": "m1",
        "eventId": None,
        "oldMapping": {"dayId": "d1"},
        "newValues": {"dayId": "d2"},
    }
    with pytest.raises(ValueError):
        bz.gantt.curriculums.move_mapping("c1", "m1", "d1")


def test_syllabus_links_and_shuffles(stub_bluz, sdk):
    stub = stub_bluz()
    stub.envelope("PATCH", "/api/gantt/syllabuses/s1", {"id": "s1"})
    stub.envelope("POST", "/api/gantt/syllabuses/s1/shuffles", {"id": "s1"})
    stub.envelope(
        "GET", "/api/gantt/syllabuses/s1/shuffles", {"modules": [], "events": []}
    )
    bz = sdk(stub)

    bz.gantt.syllabuses.set_links(
        "s1", courses=[Course(id="k1")], lead_instructor_ids=[]
    )
    assert stub.last().body == {"courseIds": ["k1"], "leadInstructorIds": []}

    bz.gantt.syllabuses.set_shuffles("s1", ["A"], {"A": "first"})
    assert stub.last().body == {"shuffles": ["A"], "descriptions": {"A": "first"}}

    bz.gantt.syllabuses.shuffle_usages("s1", ["A", "B"])
    assert stub.last().query == {"names": ["A,B"]}


def test_curriculum_execution_drift(stub_bluz, sdk):
    stub = stub_bluz()
    stub.envelope(
        "GET",
        "/api/gantt/curriculums/c1/execution",
        {"events": {"e1": {"drifted": True}, "e2": {"drifted": False}}},
    )

    execution = sdk(stub).gantt.curriculums.execution("c1")

    assert list(execution.drifted) == ["e1"]


def test_export_excel_requires_bytes(stub_bluz, sdk):
    stub = stub_bluz()
    stub.route("GET", "/api/gantt/curriculums/c1/export/excel", Raw(b"PK\x03\x04"))
    stub.envelope("GET", "/api/gantt/curriculums/c2/export/excel", {"not": "bytes"})
    bz = sdk(stub)

    assert bz.gantt.curriculums.export_excel("c1").startswith(b"PK")
    with pytest.raises(BluzApiError):
        bz.gantt.curriculums.export_excel("c2")


# --- settings & platform --------------------------------------------------------------


def test_schedule_settings_round_trip(stub_bluz, sdk):
    stub = stub_bluz()
    stub.envelope("GET", "/api/settings/schedule", {"dayStartTime": "08:00"})
    stub.envelope("POST", "/api/settings/schedule", None)
    bz = sdk(stub)

    settings = bz.settings.schedule()
    assert isinstance(settings, ScheduleSettings)
    settings.day_start_time = settings.day_start_time.replace(hour=9)
    bz.settings.set_schedule(settings)

    assert stub.last().body == {"dayStartTime": "09:00"}


def test_personal_update_merges_onto_current(stub_bluz, sdk):
    stub = stub_bluz()
    stub.envelope("GET", "/api/personal-settings", {"groups": ["g"], "instructors": []})
    stub.envelope(
        "POST", "/api/personal-settings", {"groups": ["g"], "instructors": ["i"]}
    )

    sdk(stub).personal.update(instructors=["i"])

    assert stub.last().body == {"groups": ["g"], "instructors": ["i"]}


def test_google_select_calendar_validates(stub_bluz, sdk):
    stub = stub_bluz()
    stub.envelope("POST", "/api/integrations/google-calendar/calendars", {})
    bz = sdk(stub)

    bz.google.select_calendar(create_new=True)
    assert stub.last().body == {"createNew": True}
    with pytest.raises(ValueError):
        bz.google.select_calendar("x", create_new=True)


def test_hive_lessons_join_program_ids(stub_bluz, sdk):
    stub = stub_bluz()
    stub.envelope("GET", "/api/hive/lessons", [])

    sdk(stub).hive.lessons(program_ids=[1, 2])

    assert stub.last().query == {
        "module__parent_subject__parent_program_id__in": ["1,2"]
    }


def test_health_reads_the_bare_report(stub_bluz, sdk):
    stub = stub_bluz()
    stub.route("GET", "/api/health", {"status": "degraded", "checks": {"hive": "down"}})

    report = sdk(stub).system.health()

    assert isinstance(report, HealthReport)
    assert report.healthy is False


def test_ai_ask_joins_deltas(stub_bluz, sdk):
    stub = stub_bluz()
    frames = (
        b'data: {"type":"delta","text":"Hel"}\n\n'
        b'data: {"type":"delta","text":"lo"}\n\n'
        b'data: {"type":"done","messages":[]}\n\n'
        b"data: [DONE]\n\n"
    )
    stub.route("POST", "/api/ai/chat", Raw(frames, "text/event-stream"))

    assert sdk(stub).ai.ask("hi") == "Hello"
    assert stub.last().body == {"messages": [{"role": "user", "content": "hi"}]}


def test_student_schedule_date_param(stub_bluz, sdk):
    stub = stub_bluz()
    stub.envelope(
        "GET", "/api/student-view/schedule", {"date": "2026-11-01", "events": []}
    )

    schedule = sdk(stub).student_view.schedule(date(2026, 11, 1))

    assert stub.last().query == {"date": ["2026-11-01"]}
    assert schedule.date == date(2026, 11, 1)


def test_bluz_reads_credentials_from_env(stub_bluz, sdk, monkeypatch):
    stub = stub_bluz()
    stub.envelope("GET", "/api/rooms", [])
    monkeypatch.setenv("BLUZ_URL", stub.url)
    monkeypatch.setenv("BLUZ_TOKEN", "env-token")

    with Bluz() as bz:
        assert bz.url == stub.url
        assert bz.rooms.list() == []
