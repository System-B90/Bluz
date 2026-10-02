"""
Name: test_typing.py
Purpose: Keep the SDK's public typing honest — `mypy --strict` over the SDK
         layer, so IDE/IPython inference never silently degrades to `Any`.
Created: 2026-10-02
Author: Michael K. Steinberg
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

import pytest

_PACKAGE = Path(__file__).resolve().parents[1] / "bluz"
_SDK_FILES = [
    "sdk.py",
    "api",
    "models",
    "examples",
    "errors.py",
    "client.py",
    "config.py",
    "help.py",
]


def test_sdk_layer_passes_mypy_strict() -> None:
    pytest.importorskip("mypy")
    result = subprocess.run(
        [
            sys.executable,
            "-m",
            "mypy",
            "--strict",
            "--ignore-missing-imports",
            "--python-version",
            "3.11",
            *(str(_PACKAGE / name) for name in _SDK_FILES),
        ],
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 0, result.stdout + result.stderr


def test_package_ships_py_typed() -> None:
    assert (_PACKAGE / "py.typed").is_file()
