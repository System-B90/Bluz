# Contributing to Bluz

Thanks for contributing! This is the short version — the canonical, in-depth guide is
**[AGENTS.md](../AGENTS.md)** (architecture, directory map, all commands, conventions).
Read it before your first change.

## Quick Start

```bash
git clone --recurse-submodules https://github.com/System-B90/Bluz
cd Bluz
npm ci
# create a root .env — see AGENTS.md §6 for the required variables
npm run docker:dev     # full dev stack with hot reload
```

Dev requires `bluz.dev` → `127.0.0.3` in your hosts file. See
[docs/getting-started.md](../docs/getting-started.md) for details.

## Workflow

1. **Branch** off `master`: `feature/<feature-name>` or `hotfix/<bug-name>`.
2. **Develop.** Put code in the right layer — each of `ui/src/api-client`,
   `api-server`, `api-shared`, and `components` has a `README.md` with a
   "should this file live here?" checklist.
3. **Lint & test** before pushing:
    ```bash
    npm run lint
    npm run test:unit
    npm run test:e2e   # for UI/flow changes
    ```
4. **Commit** in this repo's style: short, imperative, `Vibe-<PastTenseVerb>` prefix
   (e.g. `Vibe-Fixed flaky room-settings E2E test`). Husky runs lint-staged pre-commit.
5. **Open a PR** against `master` and fill in the template. CI runs lint, the full
   test suite, and the release build.

## Ground Rules

- **RTL-first.** The UI is Hebrew, `dir="rtl"`. Use logical CSS properties
  (`marginInlineStart`), never `marginLeft`/`marginRight`. Keep Hebrew strings intact.
- **Two engines, two databases.** Calendar = MongoDB; Gantt = PostgreSQL (Drizzle).
  Never cross the streams.
- **Respect the server/client boundary.** No browser constructs in `api-server`,
  no side effects in `api-shared`.
- **Don't edit generated files** (`drizzle/*.sql`, `ui/.next/`, reports). Regenerate
  migrations with `npm run db:generate` and commit them.
- **Don't touch `.agents/`** — vendored submodules, not Bluz source.
- **No secrets in commits**, and nothing sensitive behind `NEXT_PUBLIC_*`.
- **Style is enforced:** Prettier (4-space, double quotes, semicolons, LF) + ESLint.

## Reporting Issues

Use the issue forms (bug report / feature request). Include the surface
(Calendar vs. Gantt), environment, and version or commit hash.
