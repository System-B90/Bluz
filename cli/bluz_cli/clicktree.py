"""
Name: clicktree.py
Purpose: Duck-typed introspection of the Click command tree Typer builds.
Created: 2026-09-18
Author: Michael K. Steinberg

Typer vendors its own copy of Click (`typer._click`), so a Typer command's
parameters are **not** instances of the `click` package's `Option`/`Group` —
`isinstance(param, click.Option)` silently answers False on a modern Typer and
turns any introspection built on it into a no-op. Everything here asks what a
node *is able to do* instead, so it keeps working across both layouts.
"""

from __future__ import annotations

from typing import Any


def is_group(command: Any) -> bool:
    """True when a command holds sub-commands."""
    return bool(getattr(command, "commands", None) is not None)


def is_option(param: Any) -> bool:
    """True for `--flag` style parameters; False for positional arguments."""
    opts = getattr(param, "opts", None) or []
    return bool(opts) and str(opts[0]).startswith("-")


def takes_a_value(param: Any) -> bool:
    """True when the parameter consumes a following token on the wire."""
    return is_option(param) and not getattr(param, "is_flag", False)


def choices_of(param: Any) -> list[str] | None:
    """The fixed set a parameter accepts, when it has one."""
    choices = getattr(getattr(param, "type", None), "choices", None)
    return [str(choice) for choice in choices] if choices else None


def long_flag(param: Any) -> str:
    """The parameter's longest (i.e. most readable) spelling."""
    return max(param.opts, key=len)
