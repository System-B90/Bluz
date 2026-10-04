"""
Name: test_populate_demo_hive.py
Purpose: Regression tests for the demo Hive seeder keeping the service account.
Created: 2026-10-04
Author: Michael K. Steinberg
"""

import sys
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock

from pyhive.types import ClearanceEnum

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "demo"))

import populate_demo_hive


def user(username: str, clearance: ClearanceEnum) -> SimpleNamespace:
    return SimpleNamespace(username=username, clearance=clearance)


def test_service_account_is_protected() -> None:
    assert populate_demo_hive.is_protected_user("api", ClearanceEnum.SEGEL)


def test_admins_are_protected() -> None:
    assert populate_demo_hive.is_protected_user("admin", ClearanceEnum.ADMIN)
    assert populate_demo_hive.is_protected_user("someone", ClearanceEnum.ADMIN)


def test_ordinary_segel_is_not_protected() -> None:
    assert not populate_demo_hive.is_protected_user(
        "test-michaelks", ClearanceEnum.SEGEL
    )


def test_cleanup_keeps_the_service_account() -> None:
    # Regression: the cleanup deleted "api", its re-create failed silently,
    # and hive-lesson-queue.spec.ts got a 404 logging in as it.
    client = MagicMock()
    client.get_users.return_value = [
        user("api", ClearanceEnum.SEGEL),
        user("admin", ClearanceEnum.ADMIN),
        user("test-michaelks", ClearanceEnum.SEGEL),
    ]
    for getter in (
        "get_classes",
        "get_queues",
        "get_modules",
        "get_subjects",
        "get_programs",
        "get_lessons",
        "get_lesson_rules",
    ):
        getattr(client, getter).return_value = []

    populate_demo_hive.clean_existing_data(client)

    deleted = [call.args[0].username for call in client.delete_user.call_args_list]
    assert deleted == ["test-michaelks"]
