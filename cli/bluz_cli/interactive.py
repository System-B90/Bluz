"""
Name: interactive.py
Purpose: `bluz interactive` — a menu-driven TUI over the whole command tree.
         Walks the real Click commands rather than a hand-kept duplicate menu,
         so every command the CLI gains is in the menu the day it lands.
Created: 2026-09-18
Author: Michael K. Steinberg
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Protocol, Sequence

import typer
from rich.panel import Panel

from bluz_cli.clicktree import choices_of, is_group, is_option, long_flag
from bluz_cli.context import state
from bluz_cli.errors import BluzCliError
from bluz_cli.output import abort, console, fail, warn


def _click_exception_types() -> tuple[type[BaseException], ...]:
    """Every `ClickException` class a leaf command can raise.

    Typer vendors its own Click, and the standalone `click` package may also
    be installed and used by a plugin, so a usage error can come from either
    class tree. Both are caught when both are importable.
    """
    found: list[type[BaseException]] = []
    for module_name in ("typer._click", "click"):
        try:
            module = __import__(module_name, fromlist=["ClickException"])
        except ImportError:  # pragma: no cover - one of the two always exists
            continue
        exception = getattr(module, "ClickException", None)
        if isinstance(exception, type) and issubclass(exception, BaseException):
            found.append(exception)
    return tuple(found) or (Exception,)


_CLICK_EXCEPTIONS = _click_exception_types()

# Sentinels returned by a menu choice. Plain objects, not strings: a command
# could legitimately be named "back".
BACK = object()
QUIT = object()

# Global options live on the root callback and are answered once by the flags
# that started the session — never re-asked per command.
_SKIPPED_PARAMS = {"help"}


class Prompter(Protocol):
    """The three questions the TUI ever asks.

    A protocol rather than direct InquirerPy calls so the loop is drivable by a
    scripted prompter in tests — the menus and argument building are the logic
    worth testing, and neither needs a terminal.
    """

    def select(
        self, message: str, choices: Sequence[tuple[str, Any]], *, default: Any = None
    ) -> Any: ...

    def text(self, message: str, *, default: str = "", secret: bool = False) -> str: ...

    def confirm(self, message: str, *, default: bool = False) -> bool: ...


class InquirerPrompter:
    """The real terminal prompter, backed by InquirerPy."""

    def select(
        self, message: str, choices: Sequence[tuple[str, Any]], *, default: Any = None
    ) -> Any:
        from InquirerPy import inquirer
        from InquirerPy.base.control import Choice

        return inquirer.fuzzy(
            message=message,
            choices=[Choice(value=value, name=name) for name, value in choices],
            default=default,
            border=True,
            max_height="70%",
        ).execute()

    def text(self, message: str, *, default: str = "", secret: bool = False) -> str:
        from InquirerPy import inquirer

        if secret:
            return inquirer.secret(message=message).execute()
        return inquirer.text(message=message, default=default).execute()

    def confirm(self, message: str, *, default: bool = False) -> bool:
        from InquirerPy import inquirer

        return inquirer.confirm(message=message, default=default).execute()


@dataclass(frozen=True)
class MenuEntry:
    """One row of a menu — a group to descend into, or a command to run."""

    label: str
    value: Any
    is_group: bool


def _summary(command: Any) -> str:
    """The one-line help Click shows in a listing, or an empty string."""
    return (command.get_short_help_str(limit=60) or "").strip()


def menu_entries(group: Any) -> list[MenuEntry]:
    """Rows for one group's menu, groups first, each in declaration order.

    Groups come first because they are the tree's shape: a user scanning
    `bluz` wants "gantt" before "health", and Click's own listing is
    alphabetical, which buries them.
    """
    groups: list[MenuEntry] = []
    commands: list[MenuEntry] = []
    for name, command in group.commands.items():
        if command.hidden:
            continue
        summary = _summary(command)
        label = f"{name:<22} {summary}".rstrip()
        entry = MenuEntry(label=label, value=name, is_group=is_group(command))
        (groups if entry.is_group else commands).append(entry)
    return groups + commands


def _params(command: Any) -> tuple[list[Any], list[Any]]:
    """Split a command's parameters into (required, optional)."""
    required: list[Any] = []
    optional: list[Any] = []
    for param in command.params:
        if param.name in _SKIPPED_PARAMS:
            continue
        if is_option(param) and param.is_eager and param.expose_value is False:
            # --version and friends: they exit the process, never a value to ask for.
            continue
        (required if param.required else optional).append(param)
    return required, optional


def _param_label(param: Any) -> str:
    if is_option(param):
        name = long_flag(param)
    else:
        name = param.metavar or (param.name or "").upper()
    help_text = getattr(param, "help", None) or ""
    return f"{name} — {help_text}" if help_text else name


def ask_param(prompter: Prompter, param: Any) -> list[str] | None:
    """Ask for one parameter and return the argv fragment it contributes.

    Returns None when the answer is "leave it out" — an empty answer to an
    optional value, or a boolean flag left at its default.
    """
    option = is_option(param)
    flag = long_flag(param) if option else None
    label = _param_label(param)

    if option and param.is_flag:
        default = bool(param.default)
        answer = prompter.confirm(label, default=default)
        if answer == default:
            return None
        if param.secondary_opts:
            # A --x/--no-x pair: the off state has its own spelling.
            return [flag if answer else max(param.secondary_opts, key=len)]
        return [flag] if answer else None

    fixed = choices_of(param)
    if fixed:
        choices: list[tuple[str, Any]] = [(choice, choice) for choice in fixed]
        if not param.required:
            choices.insert(0, ("(skip)", None))
        answer = prompter.select(label, choices)
        if answer is None:
            return None
        return [flag, answer] if option else [answer]

    # A positional argument's default is never a useful prefill — it is either
    # absent or the very value the user is being asked to replace.
    default = "" if param.default is None or not option else str(param.default)
    answer = prompter.text(label, default=default)
    answer = answer.strip()
    if not answer:
        if param.required:
            raise BluzCliError(f"{label} is required.")
        return None

    if option and param.multiple:
        # Repeatable options are asked once, comma-separated, and expanded.
        fragment: list[str] = []
        for piece in answer.split(","):
            piece = piece.strip()
            if piece:
                fragment.extend([flag, piece])
        return fragment or None

    return [flag, answer] if option else [answer]


def build_args(prompter: Prompter, command: Any) -> list[str]:
    """Collect one command's arguments by asking for each parameter.

    Required parameters are always asked. Optional ones are offered as a list
    the user picks from, one at a time, so a command with fifteen options does
    not become a fifteen-question interrogation.
    """
    required, optional = _params(command)
    args: list[str] = []
    for param in required:
        fragment = ask_param(prompter, param)
        if fragment:
            args.extend(fragment)

    remaining = list(optional)
    while remaining:
        choices: list[tuple[str, Any]] = [("(run it)", None)]
        choices.extend((_param_label(param), param) for param in remaining)
        picked = prompter.select("Set an optional value?", choices)
        if picked is None:
            break
        remaining.remove(picked)
        fragment = ask_param(prompter, picked)
        if fragment:
            args.extend(fragment)
    return args


def invoke(command: Any, args: list[str]) -> None:
    """Run one leaf command, translating its failures into printed errors.

    The leaf is invoked directly rather than through the root group: the root
    callback would re-resolve global configuration, throwing away the --url /
    --token the interactive session was started with.
    """
    try:
        command.main(args=args, standalone_mode=False)
    except typer.Abort:
        warn("Cancelled.")
    except typer.Exit as exc:
        if exc.exit_code:
            warn(f"Command exited with code {exc.exit_code}.")
    except BluzCliError as exc:
        fail(str(exc))
    except _CLICK_EXCEPTIONS as exc:
        message = getattr(exc, "format_message", None)
        fail(message() if callable(message) else str(exc))
    except SystemExit as exc:  # a `--help` path can still raise this
        if exc.code:
            warn(f"Command exited with code {exc.code}.")


def _header() -> Panel:
    config = state.config
    lines = [
        f"[bold]server[/bold]  {config.url or '(not configured — run `bluz login`)'}",
        f"[bold]auth[/bold]    {'session token set' if config.token else 'no token'}",
        f"[bold]output[/bold]  {'JSON' if state.as_json else 'tables'}",
    ]
    return Panel(
        "\n".join(lines),
        title="Bluz interactive",
        subtitle="ctrl-c to cancel a prompt · pick Quit to leave",
        border_style="cyan",
    )


def run(
    root: Any,
    *,
    prompter: Prompter | None = None,
    show_header: bool = True,
) -> None:
    """Drive the menu loop until the user quits.

    `root` is the CLI's own Click group, so the menu is the command tree
    itself — there is no second list of commands to keep in step with it.
    """
    prompter = prompter or InquirerPrompter()
    if show_header:
        console.print(_header())

    breadcrumb: list[str] = []
    while True:
        group = root
        for step in breadcrumb:
            group = group.commands[step]  # type: ignore[assignment]

        entries = menu_entries(group)
        choices: list[tuple[str, Any]] = [
            (entry.label, entry.value) for entry in entries
        ]
        choices.append(
            ("← back" if breadcrumb else "quit", BACK if breadcrumb else QUIT)
        )
        if breadcrumb:
            choices.append(("quit", QUIT))

        where = " ".join(["bluz", *breadcrumb]) or "bluz"
        try:
            picked = prompter.select(f"{where} →", choices)
        except KeyboardInterrupt:
            return

        if picked is QUIT or picked is None:
            return
        if picked is BACK:
            breadcrumb.pop()
            continue

        command = group.commands[picked]
        if is_group(command):
            breadcrumb.append(picked)
            continue

        try:
            args = build_args(prompter, command)
        except BluzCliError as exc:
            fail(str(exc))
            continue
        except KeyboardInterrupt:
            warn("Cancelled.")
            continue

        console.rule(f"[cyan]{where} {picked}[/cyan]")
        invoke(command, args)
        console.print()


def interactive() -> None:
    """Browse and run Bluz commands from a menu, prompting for each argument."""
    import sys

    from bluz_cli.main import app

    # A menu needs a keyboard. Piped or redirected, InquirerPy would fail on
    # its first prompt with a terminal error that says nothing useful — say
    # what to do instead.
    if not sys.stdin.isatty():
        abort(
            "Interactive mode needs a terminal. Run the command you want "
            "directly (see `bluz --help`) when scripting."
        )

    run(typer.main.get_command(app))
