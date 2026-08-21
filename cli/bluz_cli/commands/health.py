"""
Name: health.py
Purpose: `bluz health` — the unauthenticated dependency report served at
         /api/health, the same one the container healthcheck reads.
Created: 2026-08-21
Author: Michael K. Steinberg
"""

from __future__ import annotations

import typer

from bluz_cli.commands._common import show
from bluz_cli.context import state

_PATH = "/api/health"

# "degraded" means Hive is down while Bluz itself still serves — the load
# balancer keeps routing, so the route answers 200. Only "unhealthy" is a hard
# failure, and only that maps to a non-zero exit here.
_FAILING = "unhealthy"


def health() -> None:
    """Report which dependencies are up, degraded or down.

    Exits non-zero when the overall status is `unhealthy`, so this is usable
    as a shell gate: `bluz health || echo "down"`.
    """
    with state.client() as client:
        # Not client.get: /api/health does not speak the response envelope.
        report = client.get_raw(_PATH)

    show(report, title="Health")

    if isinstance(report, dict) and report.get("status") == _FAILING:
        raise typer.Exit(1)
