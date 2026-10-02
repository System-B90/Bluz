"""
Name: test_setup_acme.py
Purpose: Tests the setup wizard's ACME certificate questions (#803).
Created: 2026-10-02
Author: Michael K. Steinberg
"""

from dataclasses import dataclass, field

import setup


@dataclass
class FakeWizard:
    """Scripted stand-in for sb90_deploy's Wizard: answers by env key."""

    answers: dict[str, str]
    confirms: list[bool]
    values: dict[str, str] = field(default_factory=dict)
    asked: list[str] = field(default_factory=list)

    def keep(self, key: str, default: str = "") -> None:
        self.values.setdefault(key, default)

    def prev(self, key: str, default: str = "") -> str:
        return self.values.get(key, default)

    def set(self, key: str, value: str) -> str:
        self.values[key] = value
        return value

    def confirm(self, message: str, default: bool = False) -> bool:
        return self.confirms.pop(0)

    def ask(
        self, key: str, message: str, default: str = "", required: bool = False
    ) -> str:
        self.asked.append(key)
        return self.set(key, self.answers.get(key, default))


def test_profiles_with_adds_and_removes_only_acme() -> None:
    assert setup._profiles_with("", "acme", True) == "acme"
    assert setup._profiles_with("x, acme", "acme", True) == "x,acme"
    assert setup._profiles_with("x,acme,y", "acme", False) == "x,y"
    assert setup._profiles_with("acme", "acme", False) == ""


def test_enabling_acme_turns_on_the_certbot_profile() -> None:
    w = FakeWizard(
        answers={"ACME_DIRECTORY_URL": "https://acme.lan/directory"},
        confirms=[True, False],
    )
    setup._ask_acme(w, "bluz.lan")  # type: ignore[arg-type]
    assert w.values["COMPOSE_PROFILES"] == "acme"
    assert w.values["ACME_DOMAIN"] == "bluz.lan"
    assert w.values["ACME_DIRECTORY_URL"] == "https://acme.lan/directory"
    assert "ACME_CA_BUNDLE" not in w.asked


def test_private_acme_ca_defaults_to_the_mounted_path() -> None:
    w = FakeWizard(answers={}, confirms=[True, True])
    setup._ask_acme(w, "bluz.lan")  # type: ignore[arg-type]
    assert w.values["ACME_CA_BUNDLE"] == setup.ACME_CA_DEFAULT_PATH


def test_declining_removes_the_profile_and_asks_nothing() -> None:
    w = FakeWizard(answers={}, confirms=[False])
    w.values["COMPOSE_PROFILES"] = "acme"
    setup._ask_acme(w, "bluz.lan")  # type: ignore[arg-type]
    assert w.values["COMPOSE_PROFILES"] == ""
    assert w.asked == []
