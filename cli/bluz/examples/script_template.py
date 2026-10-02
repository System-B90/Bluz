"""
Name: script_template.py
Purpose: Boilerplate for a new Bluz script — copy this file and fill in `run()`.
Created: 2026-10-02
Author: Michael K. Steinberg

What it sets up for you:

* credentials from `bluz login` / BLUZ_URL + BLUZ_TOKEN, overridable by flags;
* a fail-fast login check, so an expired token stops the script before any write;
* `--iteration` scoping and a `--dry-run` switch that defaults to ON;
* one place that turns every Bluz error into a readable message and exit code 1.

    python my_script.py --dry-run=no --iteration 2026a
"""

from __future__ import annotations

import argparse
import sys

from bluz import Bluz, BluzError


def run(bz: Bluz, *, dry_run: bool) -> None:
    """Your script. Read freely; guard every write with `if not dry_run`."""
    current = bz.iterations.current()
    print(
        f"Working on {current.label or current.id} ({'dry run' if dry_run else 'LIVE'})"
    )
    for course in bz.courses.roots():
        print(f"  {course.name}: {len(course.children)} sub-courses")
    if not dry_run:
        pass  # writes go here


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=__doc__.splitlines()[2] if __doc__ else None
    )
    parser.add_argument("--url", help="Server URL (default: bluz login / BLUZ_URL).")
    parser.add_argument(
        "--token", help="Session token (default: bluz login / BLUZ_TOKEN)."
    )
    parser.add_argument("--iteration", help="Iteration id to read (default: current).")
    parser.add_argument(
        "--dry-run",
        default="yes",
        choices=["yes", "no"],
        help="Print what would change without writing (default: yes).",
    )
    return parser.parse_args(argv)


def main(bz: Bluz | None = None, argv: list[str] | None = None) -> int:
    args = parse_args(argv if argv is not None else [])
    try:
        session = bz or Bluz(args.url, args.token)
        if args.iteration:
            session = session.scoped(args.iteration)
        session.require_login()
        run(session, dry_run=args.dry_run == "yes")
    except BluzError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main(argv=sys.argv[1:]))
