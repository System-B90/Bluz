"""
Name: test_setup_acme.py
Purpose: Tests the setup wizard's ACME certificate questions (#803).
Created: 2026-10-02
Author: Michael K. Steinberg
"""

import setup
from fake_wizard import FakeWizard


def test_enabling_acme_sets_the_proxy_variables() -> None:
    w = FakeWizard(
        answers={"ACME_DIRECTORY_URL": "https://acme.lan/directory"},
        confirms=[True, False],
    )
    setup._ask_acme(w, "bluz.lan")  # type: ignore[arg-type]
    assert w.values["ACME_DOMAIN"] == "bluz.lan"
    assert w.values["ACME_DIRECTORY_URL"] == "https://acme.lan/directory"
    assert w.values["ACME_CA_BUNDLE"] == ""
    assert "ACME_CA_BUNDLE" not in w.asked


def test_private_acme_ca_defaults_to_the_mounted_path() -> None:
    w = FakeWizard(answers={}, confirms=[True, True])
    setup._ask_acme(w, "bluz.lan")  # type: ignore[arg-type]
    assert w.values["ACME_CA_BUNDLE"] == setup.ACME_CA_DEFAULT_PATH


def test_declining_turns_acme_off_and_asks_nothing() -> None:
    w = FakeWizard(answers={}, confirms=[False])
    w.values["ACME_DIRECTORY_URL"] = "https://acme.lan/directory"
    setup._ask_acme(w, "bluz.lan")  # type: ignore[arg-type]
    assert w.values["ACME_DIRECTORY_URL"] == ""
    assert w.asked == []
