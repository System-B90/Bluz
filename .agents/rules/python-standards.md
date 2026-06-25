---
trigger: model_decision
description: When working with Python
---

# Python Language Constraints

- **Environment:** Default to Python v3.14 for new projects, and v3.11/v3.13 for existing ones.
- **Tooling:** Use `ruff` exclusively for all formatting and linting. Use `pytest` for testing.
- **Typing & Libraries:** Enforce strict type hints. Maximize library imports and minimize custom code. For data-heavy tasks, default to efficient libraries like NumPy.
- **CLI Standards:** Use `Typer` for CLI structures, `InquirerPy` for complex interactive prompts, and `tqdm` for tasks taking longer than 2 seconds.
- **Documentation:** Use PEP8 docstrings. Every file must include the following header:
  """
  Name: <filename>
  Purpose: <purpose>
  Created: <date>
  Author: Michael K. Steinberg
  """
