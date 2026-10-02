"""
Name: fake_wizard.py
Purpose: Scripted stand-in for sb90_deploy's Wizard, shared by the setup
         wizard tests: answers by env key, confirms from a queue.
Created: 2026-10-03
Author: Michael K. Steinberg
"""

from dataclasses import dataclass, field


@dataclass
class FakeWizard:
    """Records what was asked and the resulting env values."""

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

    def ask_secret(self, key: str, message: str) -> str:
        return self.ask(key, message)
