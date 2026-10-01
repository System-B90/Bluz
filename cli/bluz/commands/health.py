"""
Name: health.py
Purpose: `bluz health` — the unauthenticated dependency report served at
         /api/health, the same one the container healthcheck reads.
Created: 2026-08-21
Author: Michael K. Steinberg
"""

from __future__ import annotations

import typer

from bluz.commands._common import session, show

# "degraded" means Hive is down while Bluz itself still serves — the load
# balancer keeps routing, so the route answers 200. Only "unhealthy" is a hard
# failure, and only that maps to a non-zero exit here.
_FAILING = "unhealthy"


def health() -> None:
    """Report which dependencies are up, degraded or down.

    Exits non-zero when the overall status is `unhealthy`, so this is usable
    as a shell gate: `bluz health || echo "down"`.
    """
    with session() as bz:
        report = bz.system.health()

    show(report, title="Health")

    if report.status == _FAILING:
        raise typer.Exit(1)
