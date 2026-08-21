# CLAUDE.md

This project's guidance for AI agents lives in **[AGENTS.md](AGENTS.md)** — read it first.

It covers the architecture (the four-layer `api-client` / `app/api` / `api-server` /
`api-shared` split), the directory map, all the `npm` commands, environment variables, and
the project-specific conventions and gotchas (RTL Hebrew UI, dual MongoDB + PostgreSQL
engines, the server/client boundary).

Each major directory also has its own `README.md` with a "should this file live here?"
checklist — `AGENTS.md` links to all of them.

---

## Always-On Rules

Use `/caveman` mode. Less word do trick.

**Architecture & Quality**
- Assess code against DRY + SOLID. New projects: enforce SOLID, push back before writing.
- Flag micro-optimizations during code gen.
- No unit tests unless requested. Altered tested component → output updated tests.

**Git**
- Run `git status` + `git diff` before any commit instructions.
- All commit messages: `Vibe-<PastTenseVerb> <description>` (e.g. `Vibe-Implemented`, `Vibe-Fixed`). No `feat:`/`chore:` prefixes.
- Auto-commit as single command: `pwsh -Command "git add <files> && git commit -m 'Vibe-...'"`.
- Never pass `-n` / `--no-verify` (org rule). Hook fails → run auto-fixers, commit again: `npx eslint --fix && npx prettier --write`, `ruff format . && ruff check --fix .`.

**Output Formatting**
- READMEs: "Quick Start" section with copy-paste commands.
- Multiple solutions: "There are N viable solutions for X." then Pros/Cons table.
- Troubleshooting: technical root cause + fix, OR 3-7 theories. Code snippet: bulleted issue list + corrected code, no inline fix comments.
- Short, concise sentences.

**Security & Database**
- Crypto: SHA256 hash, AES-GCM encrypt, ECDSA sign. No custom crypto.
- Auth: JWT. Secrets in `.env` (generate via `InquirerPy` in `setup.py`).
- DB: PostgreSQL (`curriculum_db`) for Gantt/scheduling; MongoDB 8 for calendar/sessions.
- Deploy: Docker with explicit version tags. GitHub Actions for CI/CD.

**CI Runners**
- One workflow per pipeline. No cloud mirrors, no `BLUZ_CI_RUNNER` variable — both were deleted after the mirrors drifted from the originals.
- GitHub-hosted (`ubuntu-latest`) is the default everywhere: `release-pipeline.yml`, `docs.yml`, and e2e's `Build Test Images`.
- Self-hosted (`[self-hosted, dind]`) is for one job only: `Full Test Suite (E2E, self-hosted)` in `e2e.yml`. The suite runs ~an hour and needs the box's Hive stack.
- New job → `runs-on: ubuntu-latest` unless it runs the e2e suite.
- Don't pin buildx builder names or set `cleanup: false` on cloud runners. That existed to stop the self-hosted jobs tearing down each other's buildkit; each cloud job is its own VM.

**Windows / PowerShell**
- Always Windows 11 + PowerShell (v5/v7).
- Standard PS chaining: `;`. Logical chaining: `pwsh -Command "cmd1 && cmd2"`.

## Conditional Rules

**Web Frontend** (React/Next.js/MUI work)
- Stack: React + Next.js App Router, MUI exclusively, TypeScript + ESLint.
- RTL: logical CSS properties (`marginInlineStart`/`marginInlineEnd`), not `marginLeft`/`marginRight`.
- Dev: `npm run dev` for fast HMR unless changing Nginx or test configs.

**Python** (Python file work)
- Version: 3.14 new projects; 3.11/3.13 existing.
- Tooling: `ruff` lint/format, `pytest` tests. Strict type hints. Max library use, min custom code.
- CLI: `Typer`; interactive prompts: `InquirerPy`; progress >2s: `tqdm`.
- Every file header:
  ```python
  """
  Name: <filename>
  Purpose: <purpose>
  Created: <date>
  Author: Michael K. Steinberg
  """
  ```
