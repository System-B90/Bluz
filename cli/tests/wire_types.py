"""
Name: wire_types.py
Purpose: Response-body types shared by the conftest stub server and the wire
         tests. Lives outside conftest.py so tests import it by a unique module
         name — two conftest.py files on sys.path collide under one rootdir.
Created: 2026-08-23
Author: Michael K. Steinberg
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass
class Raw:
    """A non-envelope response body sent byte-for-byte (Excel, ICS, ...)."""

    payload: bytes
    content_type: str = "application/octet-stream"
