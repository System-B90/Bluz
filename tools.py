"""
Name: tools.py
Purpose: Entry point for the Bluz dev-ops CLI. Implementation lives in scripts/tools_impl.py.
Created: 2026-07-06
Author: Michael K. Steinberg
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / "scripts"))

from tools_impl import app  # noqa: E402

if __name__ == "__main__":
    app()
