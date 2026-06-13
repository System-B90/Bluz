---
name: database-seeding
description: Guides the agent in managing database schemas with Drizzle, running postgres and mongodb containers, applying schema changes/migrations, and seeding dummy data.
version: 1.0.0
tags:
  - drizzle
  - postgres
  - mongodb
  - seeding
---

# Database & Seeding Skill

This skill provides directions for managing Postgres and MongoDB schemas, applying database modifications, and seeding mock demo data for development.

## Checking Database Service Health

Before running migrations or seeding scripts, always verify that the Docker database containers are healthy and reachable.

### 1. Verify Containers are Running
Run the following to list running docker containers:
```bash
docker ps
```
Confirm that the following containers are up:
- `bluz-curriculum-db` (Postgres)
- `bluz-mongodb` (MongoDB)
- If testing, confirm the `bluz-test-` prefixed versions are running instead.

### 2. Check Connection Variables
Database credentials and endpoints are defined in `.env`. Ensure the variables align with Drizzle and application configurations.

---

## Drizzle Schema & Migration Management

Relational scheduling data is backed by PostgreSQL and managed via [Drizzle ORM](https://orm.drizzle.team/).

### 1. Generating Migrations
When schemas under `ui/src/api-server/gantt/schema/` are modified, generate a new SQL migration:
```bash
npm run db:generate
```
This runs `drizzle-kit generate` to compare typescript schemas with past migrations and outputs the next SQL file under the `drizzle/` directory.

### 2. Pushing Schemas (Development Sandbox)
To quickly prototype schema changes in local development without generating migration files, push schema state directly to the database:
```bash
npm run db:push
```

### 3. Database Studio Visualizer
Explore and inspect the PostgreSQL tables using Drizzle's web GUI:
```bash
npm run db:studio
```
This spawns a local server pointing to the curriculum database schema.

---

## Database Seeding

To populate Postgres and MongoDB databases with initial schedules, user accounts, and test entities:

### Run the Seeding Script
Ensure your local containers are running, then execute:
```bash
npm run db:seed
```
This script runs a two-step process:
1. `python scripts/demo/populate_demo_hive.py` - Sets up user accounts and clearances in the mock identity service.
2. `npx tsx scripts/demo/populate_demo_bluz.ts` - Seeds the calendars, events, curriculum weeks, and course modules into Bluz databases.
