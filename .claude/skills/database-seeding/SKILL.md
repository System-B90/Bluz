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

Ports: `127.0.0.3:5432` (Postgres), `127.0.0.3:27018` (MongoDB)

## Drizzle Commands
```powershell
npm run db:generate   # generate SQL migration from schema changes
npm run db:push       # push schema directly (dev sandbox, no migration file)
npm run db:studio     # open web GUI
```
Schema source: `ui\src\api-server\gantt\schema\`

## Seeding Demo Data
```powershell
npm run db:seed
# Runs: python scripts\demo\populate_demo_hive.py && npx tsx scripts\demo\populate_demo_bluz.ts
```
Requires Python 3 + Node in PATH. Run after containers are up.
