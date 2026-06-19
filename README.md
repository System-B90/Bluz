# Bluz

**Bluz** ("Bis Luz") is a Hebrew, right-to-left **scheduling and curriculum-management**
web app for an educational institution. It pairs an interactive class **Calendar** with a
**Gantt-style curriculum builder**, and reads organizational data (students, classes,
rooms, instructors) from an external **Hive** service that also provides SSO.

> **Working in this repo with an AI agent (or want the full architecture)?**
> See **[AGENTS.md](AGENTS.md)** — it documents the layered API design, directory map,
> conventions, and every command in one place.

---

## Features

- **Calendar / Schedule** — interactive class scheduling with drag-and-drop, rooms,
  instructors, prayer times, offline mode, and real-time multi-user sync. Backed by
  **MongoDB**.
- **Gantt / Curriculum** — build curriculums from syllabuses → modules → events and
  allocate them across weeks and days with scheduling constraints. Backed by **PostgreSQL**
  (via Drizzle ORM).
- **Hive SSO** — authentication and shared org data through the external Hive microservice.

## Tech stack

Next.js 16 (App Router, React 19) · TypeScript · MUI v7 + Tailwind v4 (RTL) ·
Drizzle ORM / PostgreSQL · MongoDB · next-auth · WebSocket session server · Docker Compose ·
Playwright + Vitest.

## Architecture at a glance

```
Browser → ui/src/api-client (fetch) → ui/src/app/api (routes) → ui/src/api-server (DB/Hive)
                                   ui/src/api-shared (types & contracts shared by both ends)
```

| Directory | Role |
| --- | --- |
| `ui/` | The Next.js application |
| `ui/src/api-client` · `app/api` · `api-server` · `api-shared` | The four API layers (each has a README) |
| `ui/src/components` | React components, hooks, theme |
| `drizzle/` | PostgreSQL migrations |
| `session-server/` | Standalone real-time WebSocket server |
| `scripts/` · `tests/` | Tooling, seeding, and the test suite |

## Environment variables

Runtime config lives in the root `.env` (consumed by Docker Compose and copied into
`ui/.env` for local dev). See [AGENTS.md §6](AGENTS.md#6-environment--secrets) for the full
table. Notable ones:

- `DATABASE_URL`, `POSTGRES_*` — PostgreSQL (Gantt engine)
- `MONGO_CONNECTION_STRING`, `MONGO_ROOT_*` — MongoDB (Calendar engine)
- `NEXT_PUBLIC_HIVE_URL`, `HIVE_CLIENT_ID`, `HIVE_CLIENT_SECRET` — Hive + SSO
- `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `JWT_SECRET`, `SYM_ENC_KEY` — auth & session crypto
- `WEBSOCKET_SESSION_SERVER_*` — WebSocket session server
- `NEXT_PUBLIC_GANT_DEFAULT_WEEKDAY_HOURS`, `NEXT_PUBLIC_GANT_DEFAULT_FRIDAY_HOURS` —
  default work hours for new Gantt week days

## Dependencies

- A **Hive** instance (org data + SSO).
- A **MongoDB** instance (Calendar engine).
- A **PostgreSQL** instance (Gantt engine).

Docker Compose can run all of these for you locally.

## Dev setup

Route `bluz.dev` to `127.0.0.3` in your hosts file, then:

```pwsh
pip install typer InquirerPy python-dotenv
git config core.ignorecase false
python setup.py
npm run docker:dev
```

### After updating Nginx / proxy settings

Changed `nginx.conf`? Rebuild the proxy:

```pwsh
docker compose -f docker-compose.yml -f docker-compose.dev.yml up proxy -d
```

## Common commands

```bash
npm run docker:dev     # Run the full dev stack (hot-reload)
npm run dev            # Local Next.js dev server + Dockerized proxy
npm run lint           # ESLint (lint:fix to autofix)
npm run db:generate    # Generate a Drizzle migration from schema changes
npm run db:seed        # Seed demo data
npm run test           # Full test pipeline (scripts/run_tests.py)
npm run test:unit      # Vitest only
npm run test:e2e       # Playwright e2e
```

See [AGENTS.md §5](AGENTS.md#5-commands-youll-actually-use) for the complete list.

## Project layout & deeper docs

Most directories carry their own `README.md` with an explicit "should this file live here?"
checklist:

- [`ui/src/api-client`](ui/src/api-client/README.md) — client fetch wrappers
- [`ui/src/api-server`](ui/src/api-server/README.md) — server DB controllers & Hive
- [`ui/src/api-shared`](ui/src/api-shared/README.md) — shared types & contracts
- [`ui/src/components`](ui/src/components/README.md) — React UI
- [`drizzle`](drizzle/README.md) — migrations
- [`session-server`](session-server/README.md) — WebSocket server
- [`scripts`](scripts/README.md) — tooling
- [`tests`](tests/README.md) — test suite + feature map
