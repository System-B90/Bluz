# Bluz Calendar Engine Demo Data Seeding Suite

This directory contains a complete database seeding suite that populates both the **Hive API** (segel, students, subjects, modules, student classes/rooms) and the **Bluz calendar database** (courses, sub-courses, and a 7-day schedule of diverse calendar events).

## Core Architecture

Seeding is decoupled into two cohesive steps:

1. **Hive Seeding (`populate_demo_hive.py`)**: An interactive Python script using OIDC browser SSO to authenticate against the Hive API. It clears and generates user-groups, mock users, subjects, and modules. At the end, it dumps the generated resource IDs into a local mapping file: `hive_data.json`.
2. **Bluz Seeding (`populate_demo_bluz.ts`)**: A TypeScript script that connects directly to the MongoDB instance configured in the `.env` file. It reads `hive_data.json` to acquire valid references for subjects, modules, rooms, and segel instructors. It drops existing collections and inserts 1 main course, 3 sub-courses (with randomly assigned instructors), and a full week's worth of calendar events of all types.

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

### Step 2: Seed Bluz (TypeScript)

```bash
npx tsx scripts/demo/populate_demo_bluz.ts
```

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
