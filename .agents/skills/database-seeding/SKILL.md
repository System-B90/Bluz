---
name: database-seeding
description: Guides the agent in managing database schemas with Drizzle, running postgres and mongodb containers, applying schema changes/migrations, and seeding dummy data.
version: 1.1.0
tags:
  - drizzle
  - postgres
  - mongodb
  - seeding
  - windows-11
  - pwsh-7
---

# Database & Seeding Skill (Windows 11 & PWSH 7)

This skill provides directions for managing Postgres and MongoDB schemas, applying database modifications, and seeding mock demo data for development on **Windows 11** using **PowerShell 7 (PWSH 7)**.

## Environment Constraints

- **OS:** Windows 11
- **Shell:** PowerShell 7 (PWSH 7)
- **Path Separators:** Use backslashes (`\`) for local file paths in PWSH 7 command targets.

---

## Checking Database Service Health

Before running migrations or seeding scripts, verify that the Docker database containers are healthy and reachable.

### 1. Verify Containers are Running
Run the following in PWSH 7 to list running docker containers:
```powershell
docker ps
```
Confirm that the following containers are up:
- `bluz-curriculum-db` (Postgres)
- `bluz-mongodb` (MongoDB)
- If testing, confirm the `bluz-test-` prefixed versions are running instead.

### 2. Check Connection Variables
Ensure local connection ports in `.env` match:
- PostgreSQL: `172.27.80.1:5432`
- MongoDB: `172.27.80.1:27018`

---

## Drizzle Schema & Migration Management

Relational scheduling data is backed by PostgreSQL and managed via Drizzle ORM.

### 1. Generating Migrations
When schemas under `ui\src\api-server\gantt\schema\` are modified, generate a new SQL migration:
```powershell
npm run db:generate
```

### 2. Pushing Schemas (Development Sandbox)
To push schema changes directly to the database without generating migration files, run:
```powershell
npm run db:push
```

### 3. Database Studio Visualizer
Explore and inspect the PostgreSQL tables using Drizzle's web GUI:
```powershell
npm run db:studio
```

---

## Database Seeding

To populate Postgres and MongoDB databases with initial schedules, user accounts, and test entities:

### Run the Seeding Script
Ensure your local containers are running, then execute in PWSH 7:
```powershell
npm run db:seed
```
This runs the following sequence under PWSH 7:
```powershell
python scripts\demo\populate_demo_hive.py && npx tsx scripts\demo\populate_demo_bluz.ts
```
Ensure Python 3 and Node.js are available in the system PATH.
