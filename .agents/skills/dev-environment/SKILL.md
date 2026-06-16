---
name: dev-environment
description: Spin up development environment, manage databases, run E2E Playwright tests, and diagnose container errors on Windows 11 using PowerShell 7.
version: 1.0.0
tags:
  - docker
  - dev-env
  - playwright
  - database
  - troubleshooting
---

# Dev Environment Management & Diagnostics (Windows 11 / PWSH 7)

## Environment Setup & Spinning

Always route `127.0.0.3` to `bluz.bis` in Windows hosts file (`C:\Windows\System32\drivers\etc\hosts`).
Generate environment file once: `python setup.py`

### 1. Docker-Based Development (Recommended)
Runs everything (frontend + backend) in containers.
- **Start:** `npm run docker:dev`
- **Stop:** `npm run docker:down`
- **Reset Database Volumes:** `npm run docker:nuke`

### 2. Host-Based Development (Fast Frontend HMR)
Runs Next.js on Windows host; runs proxy and databases in Docker.
- **Start:** `npm run dev`
  *(Note: Copies `.env` to `ui/.env` and starts proxy container + Next.js host server)*
- **Important:** Ensure database containers are running (`curriculum-db`, `mongodb`) before running host dev.

---

## Database Management & Seeding

Databases are mapped to host on loopback IP `127.0.0.3`:
- PostgreSQL: `127.0.0.3:5432`
- MongoDB: `127.0.0.3:27018`

### Drizzle Schema Commands
- **Generate Migrations:** `npm run db:generate`
- **Direct Schema Push (No migration file):** `npm run db:push`
- **Database Studio GUI:** `npm run db:studio`

### Database Seeding
- **Populate Mock Data:** `npm run db:seed`
  *(Runs `python scripts/demo/populate_demo_hive.py` then `npx tsx scripts/demo/populate_demo_bluz.ts`)*

---

## E2E Testing Guidelines

E2E integration tests are run via Playwright against a separate test composition.

- **Start Test Containers:** `npm run docker:test`
- **Run Tests (Headless):** `npm run test:e2e`
- **Run Tests (Interactive UI):** `npm run test:e2e:ui`
- **Stop Test Containers:** `npm run docker:test:down`

---

## Diagnostics & Logs

If errors occur, retrieve container logs using `docker logs`.

| Service | Container Name (Dev) | Container Name (Test) | Command Example |
|---|---|---|---|
| **Next.js UI** | `bluz-ui` | `bluz-test-ui` | `docker logs bluz-ui --tail 100` |
| **Websockets** | `bluz-sessions` | `bluz-test-sessions` | `docker logs bluz-sessions` |
| **Proxy (Nginx)**| `bluz-proxy` / `bluz-proxy-local` | `bluz-test-proxy` | `docker logs bluz-proxy` |
| **PostgreSQL** | `bluz-curriculum-db` | `bluz-test-curriculum-db`| `docker logs bluz-curriculum-db`|
| **MongoDB** | `bluz-mongodb` | `bluz-test-mongodb` | `docker logs bluz-mongodb` |
