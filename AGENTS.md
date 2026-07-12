# AGENTS.md — Working in the Bluz codebase

> Canonical guide for AI coding agents (and the humans pairing with them) working in
> this repository. Read this first. `CLAUDE.md` points here. Per-directory `README.md`
> files go deeper on each layer — this file tells you which one to open.

---

## 1. What Bluz is

Bluz ("Bis Luz") is a **scheduling and curriculum-management web app** for an
educational institution. The UI is **Hebrew, right-to-left** (`dir="rtl" lang="he"`).

It has two largely independent product surfaces:

| Surface | What it does | Backing store |
| --- | --- | --- |
| **Schedule / Calendar** | Interactive calendar for class events, prayer times, rooms, instructors. Drag-and-drop, offline mode, real-time sync. | **MongoDB** |
| **Gantt / Curriculum** | Builds curriculums from syllabuses → modules → events, allocates them across weeks/days with constraints. | **PostgreSQL** (via Drizzle ORM) |

Both surfaces read shared organizational data (students, classes, rooms, users,
subjects) from an external **Hive** microservice, which is also the **SSO identity
provider** (OAuth, via `next-auth`).

A standalone **WebSocket session server** broadcasts real-time edits between connected
browsers.

---

## 2. Tech stack

- **Next.js 16** (App Router, React 19, `output: "standalone"`) — app lives in `ui/`.
- **TypeScript**, strict mode. Path alias `@/*` → `ui/src/*`.
- **MUI v7** (`@mui/material`, `@mui/x-charts`, `@mui/x-date-pickers`) + Emotion, with
  RTL via `stylis-plugin-rtl`. **Tailwind v4** is also present for utility classes.
- **Drizzle ORM** + `postgres` driver for the Gantt/PostgreSQL engine.
- **MongoDB driver** for the Calendar engine.
- **next-auth v4** for Hive SSO; JWT + AES-GCM symmetric encryption for session tokens.
- **Playwright** (e2e) + **Vitest** (unit/backend) for tests. Python orchestrates the
  test pipeline (`scripts/run_tests.py`).
- **Docker Compose** for all runtime topologies (dev / local / test / prod).
- **pino** for structured logging; **OpenTelemetry** (`@vercel/otel`) for instrumentation.

---

## 3. Architecture: the layered data flow

The most important thing to understand is the **four-layer API split** under `ui/src/`.
Data flows in a strict direction, and each layer has a hard rule about what may live in
it. Putting code in the wrong layer is the most common mistake — each layer's `README.md`
has an explicit "should this file be here?" checklist.

```
 Browser (React components)
        │  calls async wrappers in …
        ▼
 ui/src/api-client/        ← fetch() wrappers. Browser-only. No DB, no secrets.
        │  HTTP to /api/* …
        ▼
 ui/src/app/api/           ← Next.js route handlers (route.ts). Thin controllers.
        │  delegate to …
        ▼
 ui/src/api-server/        ← DB controllers & external integrations. SERVER-ONLY.
        │                     MongoDB queries, Drizzle/Postgres queries, Hive client.
        ▼
 MongoDB   PostgreSQL   Hive microservice

 ui/src/api-shared/        ← Types, contracts, pure utils shared by client AND server.
                              The single source of truth for domain models. No side effects.
```

**Rules of thumb when adding code:**

- Browser `fetch` wrapper → `ui/src/api-client/` ([README](ui/src/api-client/README.md))
- A `route.ts` endpoint → `ui/src/app/api/`
- Raw DB query / Hive call / anything needing secrets → `ui/src/api-server/` ([README](ui/src/api-server/README.md))
- A type/enum/contract or pure helper used on both sides → `ui/src/api-shared/` ([README](ui/src/api-shared/README.md))
- A React component, hook, provider, or theme → `ui/src/components/` ([README](ui/src/components/README.md))

> `api-server` code must **never** import browser constructs (`window`, `useState`, etc.)
> and `api-shared` must stay **side-effect-free** so it compiles into both bundles.

### Gantt collection routes are generated

Most Gantt CRUD endpoints are not hand-written. `ui/src/app/api/gantt/base-collection.ts`
exposes `buildGantCollectionRoutes({ dbSet })`, and each `route.ts` just wires a DB
controller to it. Example (`.../gantt/curriculums/route.ts`):

```ts
export const dynamic = "force-dynamic";
import { DbCurriculum } from "@/api-server/gantt/db-curriculum";
import { buildGantCollectionRoutes } from "@/app/api/gantt/base-collection";

const { GET, POST } = buildGantCollectionRoutes({ dbSet: DbCurriculum });
export { GET, POST };
```

When adding a new Gantt entity, follow this pattern rather than writing raw handlers.

---

## 4. Directory map

| Path | What lives here | Deep doc |
| --- | --- | --- |
| `ui/` | The Next.js application (app, components, API layers, config). | — |
| `ui/src/app/` | App Router: layouts, pages, and `api/` route handlers. Route groups encode auth state: `(pre-auth)`, `(post-auth)`, `(with-hive)`, `(themed)`. | — |
| `ui/src/components/` | All React components, hooks, providers, theme. Subdirs: `auth`, `base`, `gantt`, `header`, `schedule`, `settings-dialog`, `theme`. | [README](ui/src/components/README.md) |
| `ui/src/api-client/` | Client-side fetch wrappers. | [README](ui/src/api-client/README.md) |
| `ui/src/api-server/` | Server-only DB controllers + Hive integration + Drizzle schema (`gantt/schema/`). | [README](ui/src/api-server/README.md) |
| `ui/src/api-shared/` | Shared types/contracts and pure utilities. | [README](ui/src/api-shared/README.md) |
| `drizzle/` | Generated SQL migrations + Drizzle Kit config. | [README](drizzle/README.md) |
| `session-server/` | Standalone WebSocket sync server (its own `package.json`). | [README](session-server/README.md) |
| `scripts/` | Setup, seeding, test-runner, and CI helper scripts (Python + TS). Includes `tools_impl.py`, the implementation behind root [`tools.py`](tools.py). | [README](scripts/README.md) |
| `cli/` | The `bluz` Python CLI tool (Typer + InquirerPy) — drives the `/api/*` surface. Versioned in lockstep with the app by `scripts/publish.py`. | [README](cli/README.md) |
| `tests/` | Playwright e2e specs + Vitest backend tests + auth setup. Has a full feature→test map. | [README](tests/README.md) |
| `nginx/` | Reverse-proxy configs and Dockerfile for each topology. | — |
| `.agents/` | **Vendored third-party tooling (git submodules)** — e.g. `caveman`. Not Bluz source. Don't edit. | — |

> ⚠️ The `CLAUDE.md`/`AGENTS.md` files under `.agents/caveman/` belong to that submodule,
> not to Bluz. Ignore them when reasoning about this project.

### Gantt domain model

Roughly: a **Curriculum** owns **Syllabuses** and **Weeks**. A Syllabus owns **Modules**;
a Module owns **Events**. **Days** belong to weeks, **Constraints** restrict scheduling,
and **Mappings** (`curriculum-day-module-mapping`) place modules/events onto specific
curriculum days. Type definitions live in `ui/src/api-shared/types/gantt/models/`; the
Postgres tables mirroring them live in `ui/src/api-server/gantt/schema/`.

Gantt UI state is managed with React reducers/contexts under
`ui/src/components/gantt/state/` (split into `constraints`, `mappings`, and a normalized
curriculum store via `drizzle-normalize`).

---

## 5. Commands you'll actually use

All `npm` scripts run from the repo root (`package.json`). For agents, prefer the
`tools.py` CLI (`python tools.py --help`) where a command exists — it wraps the same
npm/docker scripts but backgrounds long-running ones and gives concise, scriptable
status output instead of a blocking foreground process.

### Run the app

```bash
python tools.py dev             # Backgrounds `npm run dev`, returns immediately
python tools.py dev --docker    # Backgrounds `npm run docker:dev` instead
python tools.py dev status      # Checks port 3000 + https://bluz.dev, exit code reflects up/down
python tools.py dev stop        # Stops the background dev process tools.py started

npm run docker:dev      # Full dev stack in Docker, with hot-reload watch on ui
npm run dev             # Run Next.js dev server locally + a Dockerized proxy only
npm run docker:down      # Stop containers (also: python tools.py docker down)
npm run docker:nuke      # Stop + remove volumes, wipes local DB data (also: python tools.py docker nuke)
```

`npm run dev` copies `.env-mks-srvu` (if present) or `.env` into `ui/.env` before
starting — so edit the **root** `.env`, not `ui/.env`.

> Before starting a new dev server, check `python tools.py dev status` first — if one
> is already up, don't start another; just browse to `https://bluz.dev`.

### Lint & format

```bash
npm run lint            # ESLint over ui/ (flat config at ui/eslint.config.mts)
npm run lint:fix        # …with --fix
```

Equivalent: `python tools.py lint` / `python tools.py lint --fix`.

Prettier config (`.prettierrc`): **4-space indent, double quotes, semicolons, trailing
commas, LF**. A Husky pre-commit hook runs `lint-staged` (ESLint on JS/TS, Prettier on
JSON/CSS/MD). Match the surrounding style — it's enforced.

### Database (Gantt / PostgreSQL)

```bash
npm run db:generate     # Generate a new SQL migration from schema changes
npm run db:push         # Push schema to the DB
npm run db:studio       # Drizzle Studio GUI
npm run db:seed         # Seed demo data into Hive (python) then Bluz (tsx)
```

Equivalents: `python tools.py db generate|push|seed` (no `tools.py` wrap for `db:studio`,
which is an interactive GUI).

Drizzle config is `drizzle/drizzle.config.ts`; **schema source is
`ui/src/api-server/gantt/schema/`**, output migrations land in `drizzle/`.

### Tests

```bash
npm run test            # Full pipeline via scripts/run_tests.py (dynamic ports + seeding)
npm run test:unit       # Vitest only (unit + tests/backend/*)
npm run test:e2e        # Playwright e2e
npm run test:e2e:ui     # Playwright interactive UI
npm run docker:test     # Bring up the isolated test compose stack
npm run docker:test:down
```

Equivalent: `python tools.py test [all|unit|e2e]` (`all` is the default, mapping to
`npm run test`).

See `tests/README.md` for the full feature→spec map and the SSO auth-setup flow.

### Session server

```bash
npm run session:start   # Install + start the standalone WebSocket server
```

---

## 6. Environment & secrets

Runtime config comes from the root **`.env`** (consumed by docker-compose and copied into
`ui/.env` for local dev). Never commit real secrets. Key variables:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL`, `POSTGRES_*` | PostgreSQL (Gantt engine). |
| `MONGO_CONNECTION_STRING`, `MONGO_ROOT_*` | MongoDB (Calendar engine). |
| `NEXT_PUBLIC_HIVE_URL`, `HIVE_CLIENT_ID`, `HIVE_CLIENT_SECRET` | Hive microservice + SSO. |
| `NEXTAUTH_URL`, `NEXTAUTH_SECRET` | next-auth. |
| `JWT_SECRET`, `SYM_ENC_KEY` | Session JWT signing + AES-GCM token encryption (`ui/src/settings.tsx`). |
| `WEBSOCKET_SESSION_SERVER_*` | WebSocket session server host/auth/port/heartbeat. |
| `POSTGRES_POOL_MAX`, `POSTGRES_PREPARE`, `MONGO_MAX_POOL_SIZE`, … | DB pool tuning — see [docs/performance-and-scaling.md](docs/performance-and-scaling.md). |
| `NEXT_PUBLIC_GANT_DEFAULT_*_HOURS` | Default work hours for new Gantt week days. |
| `BLUZ_VERSION` | Docker image tag. |

> `NEXT_PUBLIC_*` vars are exposed to the browser — never put secrets behind that prefix.

---

## 7. Conventions & gotchas

- **RTL-first.** The whole app is `dir="rtl"`. When adding layout/CSS, think in logical
  properties (start/end), not left/right. MUI is configured with the RTL stylis plugin.
- **Hebrew strings** appear directly in components and tests (e.g. the SSO button label).
  Keep them intact; don't "fix" them to English.
- **Two databases, two engines.** Don't reach for Mongo in Gantt code or Postgres in
  Calendar code. The split is intentional and mirrored throughout the layers.
- **Server/client boundary is load-bearing.** A stray browser import in `api-server` (or a
  side effect in `api-shared`) breaks the build in non-obvious ways. Respect the layer
  READMEs' checklists.
- **Don't edit generated artifacts:** files in `drizzle/*.sql` (regenerate with
  `db:generate`), `ui/.next/`, `node_modules/`, `playwright-report/`, `test-results/`,
  `tsconfig.tsbuildinfo`.
- **Don't touch `.agents/` submodules** as part of Bluz changes.
- **Prefer the existing patterns:** `buildGantCollectionRoutes` for Gantt CRUD,
  `withApi` + `ApiSuccess` (`ui/src/api-server/common.tsx`) for route handlers and
  error handling, the reducer/context pattern in `components/gantt/state/` for Gantt
  UI state.
- **Platform:** primary dev is Windows + PowerShell, but Docker is the source of truth for
  runtime. Dev requires `bluz.dev` → `127.0.0.3` in your hosts file.

---

## 8. Before you finish a change

1. `npm run lint` (or `lint:fix`) passes — the pre-commit hook will block otherwise.
2. If you changed Gantt schema: `npm run db:generate` and commit the new migration.
3. If you changed behavior with test coverage: run the relevant `test:unit` / `test:e2e`.
4. Keep the per-directory `README.md` accurate if you move files between layers.
5. Commit messages in this repo are short and imperative (see `git log`). Commit all changes, even if they are not verified.
6. Create a new branch for new features `feature/<feature-name>`, and `hotfix/<bug-name>` for bugs.
7. Push only working changes after running linters and testing pipelines.
8. **UI changes need screenshots in the PR.** If a change touches anything under
   `ui/src/components/`, `ui/src/app/` pages, or otherwise alters rendered markup/styles,
   attach before/after screenshots of every affected page, modal, or component — as a PR
   comment if not included in the PR description. Cover both light/dark or RTL states if
   the change affects them. No screenshots, no merge.
