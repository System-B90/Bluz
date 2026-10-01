"""
Name: cut_dry_run.py
Purpose: Plan a curriculum cut without writing, and print what it would decide.
Created: 2026-10-02
Author: Michael K. Steinberg

Shows: the plan-then-confirm flow. `cut_plan()` runs the full pipeline with the
commit's gating but writes nothing; feed its decisions back into `cut()` once
you agree with them. This script never calls `cut()`.
"""

from __future__ import annotations

import json

from bluz import Bluz, BluzApiError


def main(bz: Bluz) -> None:
    curriculum = bz.iterations.current().curriculum
    if curriculum is None:
        print("The current iteration has no linked curriculum.")
        return

    print(f"Cut status: {curriculum.cut_status()}")
    try:
        plan = curriculum.cut_plan(insert_breaks=True)
    except BluzApiError as exc:
        # Gating (draft, no-iteration, ...) comes back as an error and writes nothing.
        print(f"Cannot cut: {exc}")
        return

    report = plan.report or {}
    decisions = report.get("decisions", [])
    print(f"{len(decisions)} open decision(s)")
    print(json.dumps(decisions, ensure_ascii=False, indent=2)[:2000])
    print("\nTo commit:  curriculum.cut(accepted_constraint_moves=..., ")
    print("                          week_overflow_resolutions=...)")


if __name__ == "__main__":
    with Bluz() as session:
        main(session)
