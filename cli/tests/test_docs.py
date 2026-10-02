"""
Name: test_docs.py
Purpose: Keep the published Python SDK docs in step with the package — every
         example is on the examples page, every API namespace on the
         namespaces page.
Created: 2026-10-02
Author: Michael K. Steinberg
"""

from __future__ import annotations

from pathlib import Path

from bluz import Bluz
from bluz.api._base import Resource
from bluz.examples import available

_DOCS = Path(__file__).resolve().parents[2] / "docs" / "python"


def test_every_example_is_embedded_in_the_docs():
    page = (_DOCS / "examples.md").read_text(encoding="utf-8")
    for name in available():
        assert f'--8<-- "cli/bluz/examples/{name}.py"' in page, name


def test_every_namespace_is_documented():
    page = (_DOCS / "namespaces.md").read_text(encoding="utf-8")
    bz = Bluz("http://example.invalid", "t")
    apis = [v for v in vars(bz).values() if isinstance(v, Resource)]
    apis += [v for v in vars(bz.gantt).values() if isinstance(v, Resource)]
    for api in apis:
        cls = type(api)
        assert f"::: {cls.__module__}.{cls.__name__}" in page, cls.__name__
