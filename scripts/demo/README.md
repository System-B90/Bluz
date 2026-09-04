# Bluz Calendar Engine Demo Data Seeding Suite

This directory contains a complete database seeding suite that populates both the **Hive API** (segel, students, subjects, modules, student classes/rooms) and the **Bluz calendar database** (courses, sub-courses, and a 7-day schedule of diverse calendar events).

## Core Architecture

Seeding is decoupled into three cohesive steps:

1. **Hive Seeding (`populate_demo_hive.py`)**: An interactive Python script using OIDC browser SSO to authenticate against the Hive API. It clears and generates user-groups, mock users, subjects, and modules. At the end, it dumps the generated resource IDs into a local mapping file: `hive_data.json`.
2. **Bluz Seeding (`populate_demo_bluz.ts`)**: A TypeScript script that connects directly to the MongoDB instance configured in the `.env` file. It reads `hive_data.json` to acquire valid references for subjects, modules, rooms, and segel instructors. It drops existing collections and inserts 1 main course, 3 sub-courses (with randomly assigned instructors), a full week's worth of calendar events of all types, and three custom event colours (in the `bluz_meta` database, where the colour picker reads them from).
3. **Gantt Seeding (`populate_demo_gantt.ts`)**: A TypeScript script that fills the *curriculum* (Postgres) side over raw SQL. Everything above lives in Mongo and describes the schedule; without this step the gantt is empty, and every curriculum-shaped e2e assertion skips itself for want of data.

## Prerequisites

- Python 3.10+ with OIDC credentials configured.
- Docker containers (`bluz-mongodb`, etc.) running (via `npm run dev` or `docker compose up`).

## How to Run

You can seed the databases using the unified npm script:

```bash
npm run db:seed
```

Alternatively, you can run the steps individually:

### Step 1: Seed Hive (Python)

```bash
python scripts/demo/populate_demo_hive.py
```

_Note: This will open your web browser to perform SSO verification against the configured Hive URL._

### Step 2: Seed Bluz schedule (TypeScript, MongoDB)

```bash
npx tsx scripts/demo/populate_demo_bluz.ts
```

### Step 3: Seed the gantt (TypeScript, Postgres)

```bash
npx tsx scripts/demo/populate_demo_gantt.ts
```

Reads `DATABASE_URL`; when that names the compose service (`bluz-curriculum-db`), it falls back to the published endpoint the same way the Mongo seeder does, honouring `POSTGRES_HOST` / `TEST_POSTGRES_PORT`.

## Gantt Structure

Two curriculums, sharing one syllabus between them:

```
מחזור הדגמה א׳ ─┬─ סילבוס משותף ── מערך פתיחה ─┬─ הרצאת פתיחה  (week 1, Sunday)
                │                              └─ תרגול פתיחה  (week 1, Monday)
                └─ סילבוס מחזור א׳ ── מערך ליבה ── הרצאת ליבה  (week 2, Sunday, weekly recurrence)
מחזור הדגמה ב׳ ─── סילבוס משותף                 (the same syllabus row)
```

Each curriculum gets two weeks of seven days (9h Sun–Thu, 5h Friday, Shabbat closed). The shared syllabus is deliberate: `curriculumIds` is a list because a syllabus can hang off several curriculums, and a single-parent seed never exercised that.

Ids are stable (`c_demo_*`, `s_demo_*`, …), so re-running replaces the same rows rather than piling up copies.

## Calendar Event Structure

The TS seeder generates a dense daily calendar schedule for the next **7 days** (today to today + 6):

- **08:00 - 08:45**: Prayer event (`תפילה` -> Shacharit)
- **08:45 - 09:15**: Break (`הפסקה` -> Breakfast)
- **09:15 - 12:00**: Lecture (`הרצאה` -> Academic subject/module lecture, assigned instructors and lecturers)
- **12:00 - 13:00**: Exercise (`ע"ע` -> Self-practice of the morning subject, assigned instructors)
- **13:00 - 14:00**: Break (`הפסקה` -> Lunch)
- **14:00 - 14:30**: Prayer event (`תפילה` -> Mincha)
- **14:30 - 17:00**: Afternoon session (alternating between Lectures and Exercises, random subjects)
- **17:00 - 17:30**: Prayer event (`תפילה` -> Arvit)
- **17:30 - 18:30**: Other (`אחר` -> Daily summary, assigned instructors)
