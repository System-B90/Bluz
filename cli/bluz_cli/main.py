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
from bluz_cli.clicktree import is_group, takes_a_value  # noqa: E402
from bluz_cli.commands import (  # noqa: E402
    ai,
    auth,
    calendar,
    colors,
    courses,
    events,
    gantt,
    health as health_cmd,
    hive,
    integrations,
    iterations,
    outsiders,
    personal,
    reservations,
    rooms,
    settings,
    student_view,
)
from bluz_cli.context import configure  # noqa: E402
from bluz_cli.interactive import interactive as interactive_cmd  # noqa: E402
from bluz_cli.errors import BluzCliError  # noqa: E402
from bluz_cli.output import fail, warn  # noqa: E402

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
app.add_typer(student_view.app, name="student-view")
app.add_typer(ai.app, name="ai")

# `bluz login` / `bluz logout` as friendly top-level aliases for the most-used auth verbs.
app.command("login")(auth.login)
app.command("logout")(auth.logout)

# Top-level because it is the one command that needs no session and answers
# about the deployment rather than about data in it.
app.command("health")(health_cmd.health)

# The menu-driven front end onto everything above. Registered last so it can
# introspect the finished command tree.
app.command("interactive")(interactive_cmd)


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
        help="[deprecated] Session token (overrides config/env). Visible in "
        "process listings -- prefer BLUZ_TOKEN.",
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
    timeout: float = typer.Option(
        None,
        "--timeout",
        help="HTTP request timeout in seconds (default 30).",
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
    if token and not quiet:
        # Deprecated: a token passed as a CLI argument is visible to any
        # other process on the machine via `ps`/Task Manager. BLUZ_TOKEN
        # (or the config file written by `bluz login`) is the safe channel.
        warn(
            "--token is deprecated and visible in process listings — use the BLUZ_TOKEN environment variable instead."
        )
    configure(
        url=url,
        token=token,
        insecure=insecure,
        as_json=json_output,
        quiet=quiet,
        timeout=timeout,
    )


@app.command()
def version() -> None:
    """Print the CLI version."""
    typer.echo(f"bluz-cli {__version__}")


# Global flags Click only recognises before the subcommand. Recognised here so
# `bluz gantt curriculums list --json` works the same as `bluz --json gantt
# curriculums list` — flags shouldn't care where you put them when chaining.
_GLOBAL_FLAGS = {"--json", "--quiet", "-q", "--insecure", "--secure"}
_GLOBAL_OPTS_WITH_VALUE = {"--url", "--token", "--timeout"}

_VALUE_TAKING_OPTIONS: set[str] | None = None


def _value_taking_options() -> set[str]:
    """
    Every `--flag` / `-x` spelling, across the whole command tree, whose Click
    option consumes a following value (i.e. is not a boolean flag).

    Built once by introspecting the real Click command tree (through
    `clicktree`, since Typer vendors its own Click and `isinstance` against
    the `click` package answers False) instead of guessing from argv shape — a guess ("any unrecognised `-x` might take a
    value") can't tell a boolean like `--with-parents` from a value option
    like `--value`, and wrongly swallowing the token after a boolean flag is
    exactly what broke `--with-parents --json` (#526).
    """
    global _VALUE_TAKING_OPTIONS
    if _VALUE_TAKING_OPTIONS is None:
        opts = set(_GLOBAL_OPTS_WITH_VALUE)

        def walk(command) -> None:
            for param in command.params:
                if takes_a_value(param):
                    opts.update(param.opts)
            if is_group(command):
                for sub in command.commands.values():
                    walk(sub)

        walk(typer.main.get_command(app))
        _VALUE_TAKING_OPTIONS = opts
    return _VALUE_TAKING_OPTIONS


def _reorder_global_flags(argv: list[str]) -> list[str]:
    """
    Move recognised global flags to the front so they work in any position.

    A token only counts as a flag when it is in flag position. The value of
    some other option can spell one exactly (`--name --json`), and hoisting it
    would both enable a global the user never asked for and leave the option it
    belonged to holding the next token instead. So a token preceded by a
    known value-taking option is treated as that option's value and left
    alone; a token preceded by a boolean flag (known or not) is not.
    """
    front: list[str] = []
    rest: list[str] = []
    previous_may_take_value = False
    i = 0
    while i < len(argv):
        arg = argv[i]
        # Everything after a bare `--` is positional data by convention.
        if arg == "--":
            rest.extend(argv[i:])
            break

        is_value_of_previous = previous_may_take_value
        if not is_value_of_previous and arg in _GLOBAL_FLAGS:
            front.append(arg)
        elif (
            not is_value_of_previous
            and arg in _GLOBAL_OPTS_WITH_VALUE
            and i + 1 < len(argv)
        ):
            front.extend([arg, argv[i + 1]])
            i += 2
            previous_may_take_value = False
            continue
        else:
            rest.append(arg)

        # `--xyz=value` carries its own value and a bare `--` was handled
        # above; otherwise only a *known* value-taking option consumes the
        # next token — a boolean flag (recognised or not) never does.
        previous_may_take_value = (
            not is_value_of_previous
            and "=" not in arg
            and arg in _value_taking_options()
        )
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
    except KeyboardInterrupt:
        # A raw traceback on Ctrl-C is noise, not information -- exit with
        # the conventional SIGINT status instead.
        typer.echo()
        fail("Interrupted.")
        sys.exit(130)


if __name__ == "__main__":
    run()
