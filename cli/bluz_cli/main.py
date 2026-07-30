"""
Name: main.py
Purpose: Root Typer application. Wires global options (--url/--token/--insecure/--json),
         registers every domain sub-app, and centralises error handling so commands
         stay free of boilerplate try/except.
Created: 2026-06-27
Author: Michael K. Steinberg
"""

from __future__ import annotations

import sys

# Windows defaults stdout/stderr to the legacy console codepage (cp1252), which
# cannot encode Hebrew text or Rich's Unicode glyphs (checkmarks, etc.) whenever
# output isn't a real attached console — piped, redirected, or run from a script
# or agent. Force UTF-8 here, before any Rich Console is constructed (commands
# import bluz_cli.output below, which instantiates Console at module load).
for _stream in (sys.stdout, sys.stderr):
    if hasattr(_stream, "reconfigure"):
        try:
            _stream.reconfigure(encoding="utf-8", errors="replace")
        except (ValueError, OSError):
            pass

import typer  # noqa: E402

from bluz_cli import __version__  # noqa: E402
from bluz_cli.commands import (  # noqa: E402
    auth,
    calendar,
    colors,
    courses,
    events,
    gantt,
    hive,
    integrations,
    iterations,
    outsiders,
    personal,
    reservations,
    rooms,
    settings,
)
from bluz_cli.context import configure  # noqa: E402
from bluz_cli.errors import BluzCliError  # noqa: E402
from bluz_cli.output import fail  # noqa: E402

app = typer.Typer(
    help="Bluz CLI — drive the Bluz scheduling & curriculum API from your terminal.",
    no_args_is_help=True,
    add_completion=True,
)

# Domain sub-apps.
app.add_typer(auth.app, name="auth")
app.add_typer(iterations.app, name="iterations")
app.add_typer(rooms.app, name="rooms")
app.add_typer(courses.app, name="courses")
app.add_typer(reservations.app, name="reservations")
app.add_typer(outsiders.app, name="outsiders")
app.add_typer(events.app, name="events")
app.add_typer(calendar.app, name="calendar")
app.add_typer(settings.app, name="settings")
app.add_typer(personal.app, name="personal")
app.add_typer(colors.app, name="colors")
app.add_typer(gantt.app, name="gantt")
app.add_typer(hive.app, name="hive")
app.add_typer(integrations.app, name="integrations")

# `bluz login` / `bluz logout` as friendly top-level aliases for the most-used auth verbs.
app.command("login")(auth.login)
app.command("logout")(auth.logout)


def _version_callback(value: bool) -> None:
    if value:
        typer.echo(f"bluz-cli {__version__}")
        raise typer.Exit()


@app.callback()
def main(
    url: str = typer.Option(
        None,
        "--url",
        help="Bluz base URL (overrides config/env).",
        rich_help_panel="Global",
    ),
    token: str = typer.Option(
        None,
        "--token",
        help="Session token (overrides config/env).",
        rich_help_panel="Global",
    ),
    insecure: bool = typer.Option(
        None,
        "--insecure/--secure",
        help="Toggle TLS verification.",
        rich_help_panel="Global",
    ),
    json_output: bool = typer.Option(
        False,
        "--json",
        help="Emit raw JSON instead of tables.",
        rich_help_panel="Global",
    ),
    quiet: bool = typer.Option(
        False,
        "--quiet",
        "-q",
        help="Suppress success/warning chatter — only data and errors. For scripting/agents.",
        rich_help_panel="Global",
    ),
    _version: bool = typer.Option(
        None,
        "--version",
        callback=_version_callback,
        is_eager=True,
        help="Show version and exit.",
    ),
) -> None:
    """Resolve global configuration before any command runs."""
    configure(url=url, token=token, insecure=insecure, as_json=json_output, quiet=quiet)


@app.command()
def version() -> None:
    """Print the CLI version."""
    typer.echo(f"bluz-cli {__version__}")


# Global flags Click only recognises before the subcommand. Recognised here so
# `bluz gantt curriculums list --json` works the same as `bluz --json gantt
# curriculums list` — flags shouldn't care where you put them when chaining.
_GLOBAL_FLAGS = {"--json", "--quiet", "-q", "--insecure", "--secure"}
_GLOBAL_OPTS_WITH_VALUE = {"--url", "--token"}


def _reorder_global_flags(argv: list[str]) -> list[str]:
    """Move recognised global flags to the front so they work in any position."""
    front: list[str] = []
    rest: list[str] = []
    i = 0
    while i < len(argv):
        arg = argv[i]
        if arg in _GLOBAL_FLAGS:
            front.append(arg)
        elif arg in _GLOBAL_OPTS_WITH_VALUE and i + 1 < len(argv):
            front.extend([arg, argv[i + 1]])
            i += 1
        else:
            rest.append(arg)
        i += 1
    return front + rest


def run() -> None:
    """Console-script entry point with top-level error translation."""
    sys.argv = [sys.argv[0]] + _reorder_global_flags(sys.argv[1:])
    try:
        app()
    except BluzCliError as exc:
        fail(str(exc))
        sys.exit(1)


if __name__ == "__main__":
    run()
