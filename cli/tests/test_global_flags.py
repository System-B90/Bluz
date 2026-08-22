"""
Name: test_global_flags.py
Purpose: Coverage for `_reorder_global_flags` (cli/bluz_cli/main.py), including
         trailing global flags after subcommand-specific options — the blind
         spot in conftest.run_cli, which only ever places globals before the
         subcommand (#526).
Created: 2026-08-22
Author: Michael K. Steinberg
"""

from __future__ import annotations

from typer.testing import CliRunner

from bluz_cli.main import _reorder_global_flags, app


def test_boolean_flag_does_not_swallow_a_trailing_global() -> None:
    """The exact regression: a boolean command flag immediately followed by --json."""
    argv = ["gantt", "modules", "list", "--with-parents", "--json"]
    assert _reorder_global_flags(argv) == [
        "--json",
        "gantt",
        "modules",
        "list",
        "--with-parents",
    ]


def test_trailing_short_quiet_flag_after_boolean_flag() -> None:
    argv = ["events", "delete", "abc", "--yes", "-q"]
    assert _reorder_global_flags(argv) == ["-q", "events", "delete", "abc", "--yes"]


def test_value_taking_option_still_keeps_its_value() -> None:
    """A real value-taking option (--output) must not have its value hoisted."""
    argv = ["gantt", "curriculums", "export", "c-1", "--output", "x.json", "--json"]
    assert _reorder_global_flags(argv) == [
        "--json",
        "gantt",
        "curriculums",
        "export",
        "c-1",
        "--output",
        "x.json",
    ]


def test_global_value_option_is_hoisted_with_its_value() -> None:
    argv = ["gantt", "modules", "list", "--url", "http://x", "--json"]
    assert _reorder_global_flags(argv) == [
        "--url",
        "http://x",
        "--json",
        "gantt",
        "modules",
        "list",
    ]


def test_leading_globals_are_unaffected() -> None:
    argv = ["--json", "-q", "gantt", "modules", "list"]
    assert _reorder_global_flags(argv) == argv


def test_end_to_end_trailing_json_flag_reaches_the_root_callback(stub_bluz) -> None:
    """
    Exercises the real bug end-to-end: CliRunner.invoke bypasses run()'s
    sys.argv reordering, so this applies _reorder_global_flags the same way
    run() does before handing argv to the Typer app.
    """
    stub = stub_bluz()
    stub.envelope("GET", "/api/gantt/modules", {"items": []})
    runner = CliRunner()

    argv = _reorder_global_flags(
        [
            "--url",
            stub.url,
            "--token",
            "test-token",
            "gantt",
            "modules",
            "list",
            "--with-parents",
            "--json",
        ]
    )
    result = runner.invoke(app, argv, catch_exceptions=False)

    assert result.exit_code == 0, result.output
    assert stub.last().query.get("withParents") == ["1"]
