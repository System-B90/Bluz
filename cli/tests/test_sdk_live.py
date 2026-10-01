"""
Name: test_sdk_live.py
Purpose: Opt-in end-to-end checks against a real Bluz (backed by Hive): every
         read the SDK models parses without a ResponseShapeWarning, so a
         server/model drift fails here instead of in someone's script.
         Read-only — safe on a shared instance.
Created: 2026-10-02
Author: Michael K. Steinberg

Run:
    BLUZ_E2E_URL=https://bluz.example BLUZ_E2E_TOKEN=... pytest tests/test_sdk_live.py
"""

from __future__ import annotations

import os
import warnings
from datetime import timedelta

import pytest
from bluz import Bluz, today
from bluz.errors import ResponseShapeWarning

_URL = os.getenv("BLUZ_E2E_URL")
_TOKEN = os.getenv("BLUZ_E2E_TOKEN")

pytestmark = pytest.mark.skipif(
    not (_URL and _TOKEN), reason="set BLUZ_E2E_URL and BLUZ_E2E_TOKEN to run"
)


@pytest.fixture(scope="module")
def bz():
    session = Bluz(
        _URL, _TOKEN, insecure=os.getenv("BLUZ_E2E_INSECURE") == "1", timeout=120
    )
    yield session
    session.close()


@pytest.fixture(autouse=True)
def strict_models():
    with warnings.catch_warnings():
        warnings.simplefilter("error", ResponseShapeWarning)
        yield


def test_health(bz):
    assert bz.system.health().status in {"healthy", "degraded"}


def test_iterations(bz):
    current = bz.iterations.current()
    assert current.is_current
    assert current.id in bz.iterations.list().ids
    bz.iterations.usage()


def test_directories(bz):
    for collection in (
        bz.rooms.list(),
        bz.courses.list(),
        bz.outsiders.list(),
        bz.colors.list(),
    ):
        assert collection is not None
    bz.reservations.list(start=today(), end=today() + timedelta(days=7))


def test_events_week(bz):
    events = bz.events.list(today(), today() + timedelta(days=7))
    for event in events[:20]:
        assert event.end_time >= event.start_time
    if events:
        bz.events.history(events[0])


def test_drafts_and_snapshots(bz):
    bz.drafts.list()
    bz.snapshots.list()


def test_every_curriculum_tree_parses(bz):
    for row in bz.gantt.curriculums.list():
        curriculum = bz.gantt.curriculums.get(row.id)
        for syllabus in curriculum:
            for module in syllabus:
                for event in module:
                    assert event.id
        for week in curriculum.weeks:
            assert all(day.id for day in week)


def test_linked_curriculum_reports(bz):
    curriculum = bz.iterations.current().curriculum
    if curriculum is None:
        pytest.skip("current iteration has no linked curriculum")
    curriculum.cut_status()
    curriculum.mappings()
    curriculum.execution()


def test_settings(bz):
    bz.settings.schedule()
    bz.settings.meal_times()
    bz.personal.get()


def test_hive_reference_data(bz):
    assert isinstance(bz.hive.subjects(), list)
    bz.system.hive_status()
