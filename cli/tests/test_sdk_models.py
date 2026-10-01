"""
Name: test_sdk_models.py
Purpose: Pure model behaviour — parsing the wire, typed dates, lossless
         round-trips, tree navigation and Collection lookups. No network.
Created: 2026-10-02
Author: Michael K. Steinberg
"""

from __future__ import annotations

import warnings
from datetime import UTC, date, datetime, time, timedelta

import pytest
from bluz.errors import DetachedModelError, NotFoundError, ResponseShapeWarning
from bluz.models import (
    Collection,
    Course,
    Curriculum,
    Event,
    EventType,
    GanttDayIndex,
    GanttEvent,
    Iteration,
    MealSettings,
    Module,
    ModuleEventType,
    Outsider,
    Reservation,
    ReserverType,
    Room,
    RoomSource,
    ScheduleSettings,
    StudentSchedule,
    Syllabus,
    camel_payload,
    to_wire,
)

CURRICULUM = {
    "id": "c1",
    "title": "Bis90",
    "description": "",
    "startDate": "2026-11-01T00:00:00.000Z",
    "isDraft": False,
    "isArchived": False,
    "createdAt": "2026-09-01T10:00:00.000Z",
    "c2s": [
        {
            "curriculumId": "c1",
            "syllabusId": "s1",
            "syllabus": {
                "id": "s1",
                "title": "Mathematics",
                "shuffles": ["A", "B"],
                "courseIds": ["k1"],
                "s2m": [
                    {
                        "syllabusId": "s1",
                        "moduleId": "m1",
                        "module": {
                            "id": "m1",
                            "title": "Algebra",
                            "m2e": [
                                {
                                    "moduleId": "m1",
                                    "eventId": "e1",
                                    "event": {
                                        "id": "e1",
                                        "title": "Intro",
                                        "type": "הרצאה",
                                        "minimumDuration": 45,
                                        "recurrence": "none",
                                        "recurrenceStartDate": None,
                                        "cEC": [
                                            {
                                                "eventId": "e1",
                                                "curriculumId": "c1",
                                                "allocatedDuration": 60,
                                            },
                                            {
                                                "eventId": "e1",
                                                "curriculumId": "c2",
                                                "allocatedDuration": 30,
                                            },
                                        ],
                                    },
                                },
                                {
                                    "moduleId": "m1",
                                    "eventId": "e2",
                                    "event": {
                                        "id": "e2",
                                        "title": "Drill",
                                        "type": 'ע"ע',
                                        "minimumDuration": 90,
                                        "cEC": [],
                                    },
                                },
                            ],
                        },
                    }
                ],
            },
        },
        {
            "curriculumId": "c1",
            "syllabusId": "s2",
            "syllabus": {"id": "s2", "title": "Physics", "s2m": []},
        },
    ],
    "c2w": [
        {
            "weekId": "w2",
            "week": {
                "id": "w2",
                "title": "Week 2",
                "number": 2,
                "weekendDuty": False,
                "w2d": [],
            },
        },
        {
            "weekId": "w1",
            "week": {
                "id": "w1",
                "title": "Week 1",
                "number": 1,
                "weekendDuty": True,
                "w2d": [
                    {"day": {"id": "d2", "dayIndex": 1, "totalWorkingMinutes": 480}},
                    {
                        "day": {
                            "id": "d1",
                            "dayIndex": 0,
                            "totalWorkingMinutes": 540,
                            "dayEndTime": "17:30",
                        }
                    },
                ],
            },
        },
    ],
    "someFutureField": {"kept": True},
}


@pytest.fixture
def curriculum() -> Curriculum:
    return Curriculum.from_wire(CURRICULUM)


# --- tree navigation ---------------------------------------------------------


def test_iterating_a_curriculum_walks_syllabuses_in_order(curriculum):
    assert [s.title for s in curriculum] == ["Mathematics", "Physics"]
    assert len(curriculum) == 2


def test_children_are_found_by_title_id_and_position(curriculum):
    assert curriculum["Mathematics"].id == "s1"
    assert curriculum["s2"].title == "Physics"
    assert curriculum[0].title == "Mathematics"
    assert "Physics" in curriculum
    assert "Chemistry" not in curriculum


def test_a_missing_child_raises_not_found(curriculum):
    with pytest.raises(NotFoundError, match="Chemistry"):
        curriculum["Chemistry"]


def test_three_level_lookup_reaches_an_event(curriculum):
    event = curriculum["Mathematics"]["Algebra"]["Intro"]
    assert isinstance(event, GanttEvent)
    assert event.minimum_duration == 45


def test_children_know_the_parent_they_were_reached_through(curriculum):
    event = curriculum["Mathematics"]["Algebra"]["Intro"]
    assert event.module.title == "Algebra"
    assert event.syllabus.title == "Mathematics"
    assert event.curriculum is curriculum


def test_flattened_views(curriculum):
    assert curriculum.modules.ids == ["m1"]
    assert curriculum.events.ids == ["e1", "e2"]
    assert curriculum["Mathematics"].events.ids == ["e1", "e2"]


def test_allocated_duration_follows_the_curriculum_reached_through(curriculum):
    event = curriculum["Mathematics"]["Algebra"]["Intro"]
    assert event.allocated_duration == 60
    assert event.allocated_in("c2") == 30
    assert event.allocated_in("nope") is None


def test_weeks_sort_by_number_and_days_by_weekday(curriculum):
    assert [w.number for w in curriculum.weeks] == [1, 2]
    week = curriculum.week(1)
    assert [d.id for d in week] == ["d1", "d2"]
    assert week.day(GanttDayIndex.MONDAY).id == "d2"
    assert week.days[0].week is week
    assert curriculum.days.ids == ["d1", "d2"]


def test_missing_week_raises(curriculum):
    with pytest.raises(NotFoundError):
        curriculum.week(9)


def test_tree_renders_every_level(curriculum):
    from rich.console import Console

    console = Console(record=True, width=120)
    console.print(curriculum.tree())
    text = console.export_text()
    for title in ("Bis90", "Mathematics", "Algebra", "Intro", "Physics"):
        assert title in text


# --- typing --------------------------------------------------------------------


def test_enums_parse_into_members(curriculum):
    intro, drill = curriculum.events
    assert intro.type is ModuleEventType.LECTURE
    assert drill.type is ModuleEventType.EXERCISE


def test_unknown_enum_values_are_kept_raw():
    event = GanttEvent.from_wire({"id": "e", "type": "חדש", "recurrence": "hourly"})
    assert event.type == "חדש"
    assert event.recurrence == "hourly"


def test_date_fields_are_dates(curriculum):
    assert curriculum.start_date == date(2026, 11, 1)
    assert curriculum.created_at == datetime(2026, 9, 1, 10, tzinfo=UTC)
    assert curriculum.week(1).day(0).day_end_time == time(17, 30)


def test_event_times_are_aware_datetimes():
    event = Event.from_wire(
        {
            "id": "e",
            "startTime": "2026-11-01T06:00:00.000Z",
            "endTime": "2026-11-01T07:30:00Z",
            "updatedAt": 1767254400000,
            "ganttOccurrenceDate": "2026-11-01",
            "type": "הפסקה",
            "rooms": [{"id": 5, "source": 1}],
        }
    )
    assert event.duration == timedelta(minutes=90)
    assert event.updated_at == datetime(2026, 1, 1, 8, tzinfo=UTC)
    assert event.gantt_occurrence_date == date(2026, 11, 1)
    assert event.type is EventType.BREAK
    assert event.rooms[0].source is RoomSource.HIVE


def test_epoch_ms_and_hhmm_round_trip_to_the_wire_format():
    event = Event.from_wire(
        {
            "id": "e",
            "startTime": "2026-11-01T06:00:00Z",
            "endTime": "2026-11-01T07:00:00Z",
            "updatedAt": 1767254400000,
        }
    )
    assert event.to_wire()["updatedAt"] == 1767254400000
    settings = ScheduleSettings.from_wire({"dayStartTime": "08:30"})
    assert settings.day_start_time == time(8, 30)
    assert settings.to_wire() == {"dayStartTime": "08:30"}


def test_settings_defaults_are_times():
    assert MealSettings().lunch_time == time(13, 0)


def test_iteration_dates_and_reservation_ids():
    iteration = Iteration.from_wire(
        {"id": "2026a", "startDate": "2026-01-01T00:00:00Z", "endDate": None}
    )
    assert iteration.start_date == datetime(2026, 1, 1, tzinfo=UTC)
    reservation = Reservation.from_wire(
        {
            "_id": "r1",
            "roomId": 3,
            "roomSource": 0,
            "start": "2026-11-01T08:00:00Z",
            "end": "2026-11-01T09:00:00Z",
            "reserverType": "outsider",
            "reserverId": "o1",
        }
    )
    assert reservation.id == "r1"
    assert reservation.reserver_type is ReserverType.OUTSIDER
    assert reservation.to_wire()["_id"] == "r1"


def test_outsider_release_date_is_a_datetime():
    outsider = Outsider.from_wire(
        {"id": "o", "name": "x", "phone": "1", "releaseDate": "2027-01-01T00:00:00Z"}
    )
    assert outsider.release_date == datetime(2027, 1, 1, tzinfo=UTC)


def test_student_schedule_date_and_times():
    schedule = StudentSchedule.from_wire(
        {"date": "2026-11-01", "calendarDayStartTime": "07:00", "events": []}
    )
    assert schedule.date == date(2026, 11, 1)
    assert schedule.calendar_day_start_time == time(7, 0)


# --- round trips --------------------------------------------------------------


def test_to_wire_keeps_unknown_fields_and_only_sent_ones(curriculum):
    wire = curriculum.to_wire()
    assert wire["someFutureField"] == {"kept": True}
    assert "isArchived" in wire
    assert "weekIds" not in wire and "weeks" not in wire


def test_assigned_fields_are_sent():
    room = Room.from_wire({"id": "r", "name": "Lab", "source": 0})
    room.description = "2nd floor"
    assert room.to_wire() == {
        "id": "r",
        "name": "Lab",
        "source": 0,
        "description": "2nd floor",
    }


def test_both_spellings_construct():
    assert Course(id="k", parent_id="p").parent_id == "p"
    assert Course.model_validate({"id": "k", "parentId": "p"}).parent_id == "p"


def test_camel_payload_merges_and_drops_none():
    payload = camel_payload({"title": "x"}, is_draft=True, start_date=None)
    assert payload == {"title": "x", "isDraft": True}
    assert camel_payload(Room(id="r", name="n"), name="m")["name"] == "m"


def test_to_wire_recurses():
    rooms = [Room(id="r", name="n")]
    assert to_wire({"rooms": rooms}) == {"rooms": [{"id": "r", "name": "n"}]}


def test_mismatched_response_warns_instead_of_raising():
    with pytest.warns(ResponseShapeWarning):
        room = Room.from_wire({"ok": True})
    assert room.to_wire() == {"ok": True}


def test_mismatched_response_can_be_made_strict():
    with warnings.catch_warnings():
        warnings.simplefilter("error", ResponseShapeWarning)
        with pytest.raises(ResponseShapeWarning):
            Room.from_wire({"ok": True})


# --- display & binding --------------------------------------------------------


def test_repr_is_short(curriculum):
    assert (
        repr(curriculum)
        == "Curriculum(id='c1', title='Bis90', is_draft=False, children=2)"
    )
    assert (
        repr(curriculum["Physics"]) == "Syllabus(id='s2', title='Physics', children=0)"
    )


def test_ipython_pretty_uses_the_short_repr(curriculum):
    pretty = pytest.importorskip("IPython.lib.pretty")
    assert pretty.pretty(curriculum) == repr(curriculum)
    assert "Mathematics" in pretty.pretty(curriculum.syllabuses)


def test_unbound_models_explain_how_to_bind():
    with pytest.raises(DetachedModelError, match="from_wire"):
        Room(id="r").delete()


# --- Collection ------------------------------------------------------------


def test_collection_lookup_and_filter():
    rooms = Collection(
        [
            Room(id="a", name="Lab", source=0),
            Room(id="b", name="Hall", source=1),
        ]
    )
    assert rooms["Hall"].id == "b"
    assert rooms["a"].name == "Lab"
    assert rooms[1].id == "b"
    assert rooms.find("nope") is None
    assert rooms.where(source=RoomSource.HIVE).ids == ["b"]
    with pytest.raises(KeyError):
        rooms["nope"]


def test_collection_repr_truncates():
    rooms = Collection(Room(id=str(i)) for i in range(10))
    assert "5 more" in repr(rooms)


def test_flat_module_shape_is_not_a_loaded_tree():
    module = Module.from_wire({"id": "m", "title": "t", "events": ["e1"]})
    assert module.event_ids == ["e1"]
    assert "children" not in repr(module)


def test_syllabus_without_parent_curriculum_returns_none_for_many():
    syllabus = Syllabus.from_wire({"id": "s", "curriculumIds": ["a", "b"]})
    assert syllabus.curriculum is None
