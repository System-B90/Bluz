"""
Name: conftest.py
Purpose: Puts scripts/ on sys.path so the tests can import tools_impl the same
         way the root tools.py entry point does.
Created: 2026-08-21
Author: Michael K. Steinberg
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
