---
name: schedule-building
description: Building and editing Bluz schedules via the bluz CLI — curriculum cuts, event placement, and the meal-break rules an agent must not violate.
tags: [bluz-cli, scheduling, gantt, curriculum]
---

## Meal Breaks Are Fixed — Do Not Move Them

Every curriculum is auto-seeded with a `הפסקות` syllabus holding three daily
meal events. The cut planner recognizes them **by title** and pins each to the
clock time in the global `mealTimes` setting instead of stacking it after the
previous event.

| Event title | Settings key | Default time | Duration |
|---|---|---|---|
| `ארוחת בוקר` | `breakfastTime` | 07:00 | 35 min |
| `הפסקת צהריים` | `lunchTime` | 13:00 | 90 min |
| `ארוחת ערב` | `dinnerTime` | 19:00 | 45 min |

**Rules — no exceptions unless the user explicitly asks:**

- Never change the start time, duration, or day of a lunch or dinner event.
- Never delete, archive, unlink, or rename a meal event or the `הפסקות`
  syllabus/module. Renaming breaks the title match and the planner stops
  pinning it.
- Never edit the `mealTimes` setting to make a schedule fit. Move the *other*
  events instead.
- When a requested block collides with a meal window, split it around the
  break or shift it — do not push the break.

"Explicitly" means the user named the meal break and the change they want
("move lunch to 12:30", "drop dinner on Fridays"). A general instruction like
"fit these lectures into Tuesday" or "compact the schedule" is **not**
permission to touch a break.

If a request cannot be satisfied without moving a break, say so and ask
before doing it.

## Quick Start

```bash
bluz gantt curriculums list
bluz gantt curriculums cut <curriculum-id>      # plan → real calendar events
bluz --json events list --start 2026-01-01T00:00:00Z --end 2026-01-08T00:00:00Z
```

Add `--json` for machine-readable output and `-q` to suppress chatter — both
work before or after the subcommand.

## Where This Lives In Code

- `ui/src/api-shared/types/settings/meal.ts` — titles, defaults, durations.
- `ui/src/api-shared/gantt/cut-planner.ts` — the pinning and split-around-window
  logic.
- `ui/src/api-server/gantt/db-curriculum.ts` — `seedMealBreaksSyllabus`.
