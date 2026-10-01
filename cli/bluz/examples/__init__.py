"""
Name: __init__.py
Purpose: Runnable, copy-pasteable example scripts for the Bluz SDK.
Created: 2026-10-02
Author: Michael K. Steinberg

Every module here exposes `main(bz: Bluz) -> None` and runs on its own:

    python -m bluz.examples                    # list the examples
    python -m bluz.examples walk_curriculum    # run one (uses your `bluz login`)

Read them in your editor (`bluz.examples.walk_curriculum.__file__`) or in
IPython (`import bluz.examples.walk_curriculum as ex; ex??`).
"""

from __future__ import annotations

import importlib
import pkgutil
from types import ModuleType

__all__ = ["available", "load"]


def available() -> dict[str, str]:
    """Example name → its one-line summary."""
    examples: dict[str, str] = {}
    for info in pkgutil.iter_modules(__path__):
        if info.name.startswith("_"):
            continue
        module = load(info.name)
        summary = (module.__doc__ or "").strip().splitlines()
        examples[info.name] = next(
            (
                line.split(":", 1)[1].strip()
                for line in summary
                if line.startswith("Purpose:")
            ),
            "",
        )
    return examples


def load(name: str) -> ModuleType:
    """Import one example module by name."""
    return importlib.import_module(f"{__name__}.{name}")
