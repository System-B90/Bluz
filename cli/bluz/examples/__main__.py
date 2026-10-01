"""
Name: __main__.py
Purpose: `python -m bluz.examples [name]` — list the examples, or run one.
Created: 2026-10-02
Author: Michael K. Steinberg
"""

from __future__ import annotations

import sys

from bluz.examples import available, load
from bluz.sdk import Bluz


def run(argv: list[str]) -> int:
    examples = available()
    if not argv or argv[0] not in examples:
        width = max(map(len, examples))
        print("Usage: python -m bluz.examples <name>\n")
        for name, summary in examples.items():
            print(f"  {name:<{width}}  {summary}")
        return 0 if not argv else 2
    module = load(argv[0])
    with Bluz() as bz:
        module.main(bz)
    return 0


if __name__ == "__main__":
    sys.exit(run(sys.argv[1:]))
