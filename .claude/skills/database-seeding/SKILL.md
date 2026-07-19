---
name: database-seeding
description: Drizzle schema management, Postgres/MongoDB container health checks, and demo seeding.
tags: [drizzle, postgres, mongodb, seeding]
---

## Health Check
```powershell
docker ps
```
Verify running: `bluz-curriculum-db` (Postgres), `bluz-mongodb` (MongoDB).
Test stack variants: `bluz-test-curriculum-db`, `bluz-test-mongodb`.

Ports: `172.27.80.1:5432` (Postgres), `172.27.80.1:27018` (MongoDB)

## Drizzle Commands
```powershell
npm run db:generate   # generate SQL migration from schema changes (also: python tools.py db generate)
npm run db:push       # push schema directly, dev sandbox, no migration file (also: python tools.py db push)
npm run db:studio     # open web GUI (no tools.py wrap — interactive)
```
Schema source: `ui\src\api-server\gantt\schema\`

## Seeding Demo Data
```powershell
npm run db:seed
# also: python tools.py db seed
# Runs: python scripts\demo\populate_demo_hive.py && npx tsx scripts\demo\populate_demo_bluz.ts
```
Requires Python 3 + Node in PATH. Run after containers are up.
