"""
Name: test_interactive.py
Purpose: Cover `bluz interactive` — the menu it builds from the real command
         tree, the argv it assembles from answered prompts, and one full
         menu → prompt → HTTP round trip against the stub server.
Created: 2026-09-18
Author: Michael K. Steinberg
"""

from __future__ import annotations

from collections.abc import Sequence
from typing import Any

import click
import pytest
import typer
from bluz_cli import interactive
from bluz_cli.context import configure
from bluz_cli.errors import BluzCliError
from bluz_cli.main import app


class ScriptedPrompter:
    """A prompter that replays canned answers, so no terminal is needed.

    Selections are matched by the *value* a caller offered, and text/confirm
    answers are consumed in order — mirroring what a user types.
    """

    def __init__(
        self,
        selections: Sequence[Any] = (),
        texts: Sequence[str] = (),
        confirms: Sequence[bool] = (),
    ) -> None:
        self.selections = list(selections)
        self.texts = list(texts)
        self.confirms = list(confirms)
        self.asked: list[str] = []

    def select(self, message, choices, *, default=None):
        self.asked.append(message)
        wanted = self.selections.pop(0)
        offered = {label: value for label, value in choices}
        if wanted in offered.values() or wanted is None:
            return wanted
        for label, value in offered.items():
            if label.split()[0] == wanted:
                return value
        raise AssertionError(f"{wanted!r} was not offered in {list(offered)}")

    def text(self, message, *, default="", secret=False):
        self.asked.append(message)
        return self.texts.pop(0)

    def confirm(self, message, *, default=False):
        self.asked.append(message)
        return self.confirms.pop(0)


@pytest.fixture
def root() -> click.Group:
    return typer.main.get_command(app)


# --- the menu ----------------------------------------------------------------


def test_menu_lists_every_visible_command_of_a_group(root):
    entries = interactive.menu_entries(root)

    values = [entry.value for entry in entries]
    assert "gantt" in values
    assert "interactive" in values
    assert set(values) == set(root.commands)


def test_menu_puts_groups_before_leaf_commands(root):
    entries = interactive.menu_entries(root)

    kinds = [entry.is_group for entry in entries]
    assert kinds == sorted(kinds, reverse=True)


def test_menu_labels_carry_the_command_summary(root):
    entries = {entry.value: entry.label for entry in interactive.menu_entries(root)}

    assert "Gantt" in entries["gantt"]


def test_menu_descends_into_a_subgroup(root):
    entries = interactive.menu_entries(root.commands["gantt"])

    assert "curriculums" in [entry.value for entry in entries]


# --- argument building -------------------------------------------------------


def _command(root: click.Group, *path: str) -> click.Command:
    node: click.Command = root
    for step in path:
        node = node.commands[step]  # type: ignore[attr-defined]
    return node


def test_required_arguments_are_asked_for_in_order(root):
    prompter = ScriptedPrompter(texts=["c-1"], selections=[None])

    args = interactive.build_args(
        prompter, _command(root, "gantt", "curriculums", "get")
    )

    assert args == ["c-1"]


def test_required_options_are_spelled_with_their_long_flag(root):
    prompter = ScriptedPrompter(texts=["e-1", "m-1", "א,ב"], selections=[None])

    args = interactive.build_args(
        prompter, _command(root, "gantt", "events", "shuffle-group")
    )

    assert args == ["e-1", "--module-id", "m-1", "--shuffles", "א,ב"]


def test_an_empty_answer_to_a_required_value_is_refused(root):
    prompter = ScriptedPrompter(texts=[""])

    with pytest.raises(BluzCliError):
        interactive.build_args(prompter, _command(root, "gantt", "curriculums", "get"))


def test_optional_values_are_offered_and_can_be_skipped(root):
    # Pick nothing from the optional list: "(run it)" answers None.
    prompter = ScriptedPrompter(texts=["c-1"], selections=[None])

    args = interactive.build_args(
        prompter, _command(root, "gantt", "curriculums", "constraints")
    )

    assert args == ["c-1"]


def test_an_optional_value_is_added_when_picked(root):
    command = _command(root, "gantt", "curriculums", "constraints")
    syllabus = next(p for p in command.params if p.name == "syllabus_id")
    prompter = ScriptedPrompter(texts=["c-1", "s-9"], selections=[syllabus, None])

    args = interactive.build_args(prompter, command)

    assert args == ["c-1", "--syllabus-id", "s-9"]


def test_a_flag_left_at_its_default_contributes_nothing(root):
    command = _command(root, "gantt", "curriculums", "list")
    with_parents = next(p for p in command.params if p.name == "with_parents")
    prompter = ScriptedPrompter(selections=[with_parents, None], confirms=[False])

    assert interactive.build_args(prompter, command) == []


def test_a_flag_turned_on_contributes_its_long_spelling(root):
    command = _command(root, "gantt", "curriculums", "list")
    with_parents = next(p for p in command.params if p.name == "with_parents")
    prompter = ScriptedPrompter(selections=[with_parents, None], confirms=[True])

    assert interactive.build_args(prompter, command) == ["--with-parents"]


def test_a_paired_flag_turned_off_uses_its_negative_spelling(root):
    command = _command(root, "gantt", "curriculums", "cut")
    breaks = next(p for p in command.params if p.name == "insert_breaks")
    prompter = ScriptedPrompter(
        selections=[breaks, None], texts=["c-1"], confirms=[False]
    )

    assert interactive.build_args(prompter, command) == ["c-1", "--no-insert-breaks"]


def test_a_repeatable_option_expands_one_flag_per_value(root):
    command = _command(root, "ai", "chat")
    approve = next(p for p in command.params if p.name == "approve")
    prompter = ScriptedPrompter(texts=["hi", "a,b"], selections=[approve, None])

    args = interactive.build_args(prompter, command)

    assert args == ["hi", "--approve", "a", "--approve", "b"]


# --- the loop ----------------------------------------------------------------


def test_the_loop_runs_the_picked_command_against_the_server(
    stub_bluz, run_cli, root, tmp_path, monkeypatch
):
    stub = stub_bluz()
    stub.envelope("GET", "/api/iterations", [{"id": "2026a"}])
    monkeypatch.setenv("APPDATA", str(tmp_path))
    monkeypatch.setenv("XDG_CONFIG_HOME", str(tmp_path))
    monkeypatch.setenv("HOME", str(tmp_path))
    configure(
        url=stub.url, token="t", insecure=None, as_json=True, quiet=True, timeout=None
    )

    prompter = ScriptedPrompter(
        selections=["iterations", "list", None, interactive.QUIT]
    )
    interactive.run(root, prompter=prompter, show_header=False)

    assert stub.last().path == "/api/iterations"


def test_the_loop_goes_back_up_a_level_without_running_anything(
    stub_bluz, root, tmp_path, monkeypatch
):
    stub = stub_bluz()
    monkeypatch.setenv("HOME", str(tmp_path))
    configure(
        url=stub.url, token="t", insecure=None, as_json=True, quiet=True, timeout=None
    )

    prompter = ScriptedPrompter(
        selections=["gantt", interactive.BACK, interactive.QUIT]
    )
    interactive.run(root, prompter=prompter, show_header=False)

    assert stub.requests == []


def test_a_failing_command_is_reported_and_the_loop_survives(
    stub_bluz, root, tmp_path, monkeypatch, capsys
):
    stub = stub_bluz()
    stub.route(
        "GET",
        "/api/iterations",
        {"status": 1, "error": {"name": "Boom", "message": "nope"}},
        status=500,
    )
    monkeypatch.setenv("HOME", str(tmp_path))
    configure(
        url=stub.url, token="t", insecure=None, as_json=True, quiet=True, timeout=None
    )

    prompter = ScriptedPrompter(
        # The menu stays inside `iterations` after a command runs, so the
        # retry picks `list` again rather than re-entering the group.
        selections=["iterations", "list", None, "list", None, interactive.QUIT]
    )
    interactive.run(root, prompter=prompter, show_header=False)

    # Two attempts made it out: the first failure did not end the session.
    assert len(stub.requests) == 2
    assert "nope" in capsys.readouterr().err


def test_interactive_refuses_to_run_without_a_terminal(run_cli, stub_bluz):
    stub = stub_bluz()

    result = run_cli(stub, "interactive")

    assert result.exit_code == 1
    assert "needs a terminal" in result.stderr
