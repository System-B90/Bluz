"""
Name: test_api_coverage.py
Purpose: Guard the CLI's promise that it speaks the whole `/api/*` surface —
         every Next.js route handler in the app must have a command that calls
         it, so a new endpoint cannot ship CLI-less.
Created: 2026-09-18
Author: Michael K. Steinberg
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest

_REPO_ROOT = Path(__file__).resolve().parents[2]
_ROUTES_ROOT = _REPO_ROOT / "ui" / "src" / "app" / "api"
_CLI_ROOT = _REPO_ROOT / "cli" / "bluz_cli"

# Routes no command can or should call.
_NOT_CLI_SURFACE = {
    # next-auth's own handler: the browser sign-in flow. `bluz login` drives
    # it through a real browser and redeems a handoff code instead.
    "auth/[...nextauth]",
}


# How many times string constants are inlined into each other. Paths are
# written against a module constant (`f"{_BASE}/curriculums/..."`), and the
# generated entity apps add a second hop (`base = f"{_BASE}/{entity}"`), so two
# passes resolve everything the CLI actually builds.
_INLINE_PASSES = 3

_STRING_ASSIGNMENT = re.compile(r'^\s*(\w+) = f?"([^"\n]*)"', re.MULTILINE)


def _cli_source() -> str:
    """Every command module's text, with its string constants inlined.

    Request paths never appear in the source as one literal: they are
    f-strings built from a module-level `_BASE` and, inside the Gantt entity
    factory, from a per-entity `base`. Substituting the assignments back in
    reconstructs the path the CLI puts on the wire.
    """
    chunks: list[str] = []
    for path in sorted(_CLI_ROOT.rglob("*.py")):
        text = path.read_text(encoding="utf-8")
        constants = {
            name: value
            for name, value in _STRING_ASSIGNMENT.findall(text)
            if value.startswith("/") or "{" in value
        }
        for _ in range(_INLINE_PASSES):
            for name, value in constants.items():
                text = text.replace("{" + name + "}", value)
        chunks.append(text)
    return "\n".join(chunks)


def _route_paths() -> list[str]:
    return sorted(
        route.parent.relative_to(_ROUTES_ROOT).as_posix()
        for route in _ROUTES_ROOT.rglob("route.ts")
    )


def _pattern_for(route: str) -> re.Pattern[str]:
    """A regex matching how the CLI would spell this route.

    A dynamic route segment (`[id]`) is an f-string hole in the CLI, and an
    f-string hole in the CLI may itself stand for a static segment — the Gantt
    entity apps are generated, so `curriculums` arrives as `{entity}`.
    """
    parts = []
    for segment in route.split("/"):
        if segment.startswith("["):
            parts.append(r"\{[^/}]+\}")
        else:
            parts.append(f"(?:{re.escape(segment)}|" + r"\{[^/}]+\})")
    return re.compile("/api/" + "/".join(parts) + r'(?=["/?\s])')


@pytest.mark.parametrize("route", _route_paths())
def test_every_api_route_has_a_cli_caller(route: str) -> None:
    if route in _NOT_CLI_SURFACE:
        pytest.skip("not part of the CLI surface")

    assert _pattern_for(route).search(_cli_source() + " "), (
        f"/api/{route} has no CLI command. Add one (see cli/README.md) or, if "
        "it genuinely cannot have one, list it in _NOT_CLI_SURFACE with why."
    )


def test_the_route_scan_actually_found_the_app() -> None:
    """A guard on the guard: an empty scan would pass every assertion above."""
    routes = _route_paths()

    assert len(routes) > 50
    assert "iterations" in routes


def test_the_guard_rejects_a_route_nothing_calls() -> None:
    """The scan is loose enough to resolve f-strings — but not so loose that
    it matches a path the CLI never builds."""
    assert _pattern_for("nowhere/[id]/at-all").search(_cli_source()) is None
