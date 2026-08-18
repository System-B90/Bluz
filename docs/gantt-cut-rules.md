# Gantt cut — scheduling rules and priorities

How the curriculum → schedule cut (**גזירה ללו"ז**) decides *where* every event
lands: how a week is balanced, how breaks are spread through a day, and how
constraints are honoured.

Every threshold, weight and priority described here is a named constant in
**[`ui/src/api-shared/gantt/cut-rules.ts`](../ui/src/api-shared/gantt/cut-rules.ts)**.
That file is the tunable source of truth — change policy there, not in the
planner. This page is its prose companion; keep the two in sync.

## Quick start

Change a rule without touching any algorithm:

```powershell
# All tunables live in one file
code ui/src/api-shared/gantt/cut-rules.ts

# Longer post-exercise break:      BREAK_RULES["post-long-exercise"].preferredMinutes
# Different long-ע"ע threshold:    LONG_EXERCISE_THRESHOLD_MINUTES
# Stronger module cohesion:        SPILLOVER_RULES.moduleCohesionBonusMinutes
# Turn a break rule off entirely:  BREAK_RULES[<kind>].enabled = false
# Reorder the whole ladder:        CUT_PRIORITY_LADDER

npm run typecheck
npm run test:unit
```

## The pipeline

The cut runs four passes, in this order. Each one may only rearrange what the
previous one produced — never undo it.

| # | Pass | Module | What it decides |
| - | ---- | ------ | --------------- |
| 1 | Expand | `cut-planner.ts` | Which days each event and recurrence echo lands on. |
| 2 | Balance | `cut-balancer.ts` | Spills work off over-full days onto later days in the same week. |
| 3 | Constraints | `cut-constraints.ts` | Reorders within a day; proposes cross-day moves. |
| 4 | Breaks | `cut-breaks.ts` | Spreads a day's leftover slack through the day as הפסקה events. |

Passes 2–4 are pure and minute-domain. Only the planner touches timezones.

## Priority ladder

When two rules disagree, the **earlier** entry wins. This is the tie-breaker of
record — the balancer, the break pass and the constraint solver all resolve
conflicts by consulting `CUT_PRIORITY_LADDER`.

1. **`within-working-hours`** — nothing is ever placed past a day's end time.
   Overlapping events is always the lesser wrong.
2. **`same-week-only`** — spillover flows between days of one week, never
   between weeks.
3. **`never-spill-into-full-day`** — an overlap on day X beats a spill onto a
   day X+1 that is already at capacity.
4. **`pinned-events-stay`** — meals and daily recurrence echoes never move;
   weekly echoes are free to.
5. **`satisfy-constraints`** — subject to everything above.
6. **`module-cohesion`** — events from one module stay on one day when possible.
7. **`breaks-by-priority`** — breaks fill existing slack only, in rule order.
8. **`prayer-alignment`** — best-effort on both sides (cover prayers with
   breaks, keep lectures off them).

## Day capacity

A day's capacity is its **working window** — the clock span from its start time
to `GanttDay.dayEndTime`, editable per day in the Weeks tab.

- Leaving the end time empty means *derive it*: the day's start time plus
  `totalWorkingMinutes`. That is exactly how days behaved before the field
  existed, so nothing changes for a curriculum that never sets it.
- The start time comes from the schedule settings (`dayStartTime`, or
  `weekendHomeStartTime` for a Sunday after a weekend at home).
- **Everything inside the window counts against it**: lessons, pinned meal
  events, and generated breaks alike.
- Slack below `CAPACITY_RULES.negligibleSlackMinutes` is treated as zero.

## Spillover

Auto-spillover is on by default and can be unchecked per cut in the dialog.

**Invariants** (`SPILLOVER_RULES`) — the balancer may never break these:

1. Never across weeks.
2. Never onto a day that cannot hold the event inside its own window.
3. Never past a day's end time.
4. Forward only — an event's mapped day is the earliest anyone asked for it.

Spill **cascades**: work pushed off ראשון can be pushed again off שני, so a week
with everything piled onto one day rebalances across the whole week.

**Selection** is best-fit: the balancer picks whichever movable event packs the
later days most tightly, adjusted by two weights —
`moduleCohesionBonusMinutes` (rewards landing beside same-module siblings) and
`moduleSplitPenaltyMinutes` (discourages leaving siblings behind).

**What may move** (`isSpillable`):

| Kind | Movable | Why |
| ---- | ------- | --- |
| Ordinary mapped event | ✅ | |
| Weekly recurrence (anchor or echo) | ✅ | Its day is a preference, not a promise. |
| Daily recurrence (anchor or echo) | ❌ | "Every day" stops being true the moment one hops. Moving the *anchor* is worse still: echo days are derived from its mapping before balancing runs, so relocating it empties the mapped day and doubles up on the target. |
| Pinned meal event | ❌ | Its whole purpose is a fixed clock time. |

### When a week does not fit

If a week is still over capacity after balancing, the cut does **not** invent
hours. It reports a `week-overflow` decision and the dialog asks the user, one
week at a time:

| Resolution | Effect |
| ---------- | ------ |
| `overlap-source` *(default)* | Leftovers overlap inside the day's window — the stack wraps back to the day's start rather than running past its end. |
| `overlap-least-full` | Overlap is placed on the week's least-loaded day. |
| `extend-day` | The only resolution that lets a day run past its end time. |
| `drop` | Leftovers are simply not cut. |

## Breaks

The break pass runs after events have their final days and times. Its job is to
take the empty tail that would otherwise sit at the end of a day and spread it
through the day deliberately.

**Hard guarantee: breaks never extend a day.** They only consume existing
slack. When there is less slack than the day wants, higher-priority kinds are
satisfied first and the rest are dropped — never shortened below their
`minimumMinutes`.

| Priority | Kind | Length (min/preferred/max) | Trigger |
| -------- | ---- | -------------------------- | ------- |
| 1 | `post-long-exercise` | 10 / 15 / 20 | After ≥ 90 min of continuous ע"ע. |
| 2 | `between-syllabuses` | 10 / 15 / 20 | Between consecutive lectures from different syllabuses. |
| 3 | `prayer-cover` | 10 / 15 / 20 | A break positioned to cover a prayer window. |
| 4 | `post-lecture` | 10 / 10 / 15 | After any lecture. |
| 5 | `room-change` *(disabled)* | 5 / 5 / 5 | Between events in different rooms. |

`room-change` is **specified but disabled**: the cut assigns no rooms today
(`rooms: []` in `api-server/gantt/cut.ts`) and a Gantt event only carries a
coarse `roomRequirement`. Flip `BREAK_RULES["room-change"].enabled` on once real
room assignment lands — `roomKeyOf` already exempts `ללא כיתה` and `בחוץ`.

### Placement rules

- **Never adjacent to an existing הפסקה** — a meal event or anything from the
  auto-seeded הפסקות syllabus. Two touching breaks read as one dead zone.
  Instead, an *earlier* break in the same day is grown, up to
  `earlierBreakGrowthCapMinutes` (20).
- **No implicit 25+ minute breaks.** `implicitBreakCeilingMinutes` caps how far
  any single break may grow — two breaks of 10 and 15 at different times beat
  one of 25.
- **Leftover slack is redistributed**, highest-priority break first, rather
  than left as one long empty tail at the end of the day.
- Breaks under `minimumMaterializedMinutes` (5) are not worth creating.

### Materialization

Generated breaks are **real schedule events** of type `BREAK`, titled `הפסקה`.
They carry a synthetic `ganttEventId` prefixed `cut-break:`, which means:

- a pull-back (משיכה חזרה) archives them alongside everything else the cut
  created, since it matches on `ganttEventId` existing;
- a re-cut never duplicates them.

## Prayers

Prayer times (שחרית / מנחה / ערבית) live in the **MongoDB** schedule settings,
while the cut reads its data from **PostgreSQL**. The server is the only layer
that can bridge the two engines: `prayerWindowsFromSettings` in
`api-server/gantt/cut.ts` reads them and hands the pure planner plain `"HH:mm"`
strings.

They are **soft** windows, unlike meals:

- Breaks prefer positions that cover a prayer — a boundary whose break would
  land on one is promoted above the normal priority order, because prayer
  alignment costs nothing when it is achievable.
- A break counts as covering a prayer at `coverageThresholdMinutes` (10) of
  overlap.
- Lectures prefer not to sit on a prayer, but a prayer never forces spillover
  and never extends a day (`mayExtendDay: false`).
- A missing or malformed prayer setting contributes no window. Prayers must
  never fail a cut.

## Constraints

`GanttConstraint`s come in two shapes — relational (`after`/`before`, with
optional `minDelayDays`/`maxDelayDays`) and temporal (allowed/forbidden
weekdays) — and may be owned by an event or by a whole module (which fans out
to all of its events).

The solver (`CONSTRAINT_RULES`):

- **reorders within a day** silently — nothing moves between days, so there is
  nothing to ask about;
- **proposes cross-day moves** within the same week, and never applies them
  silently. They surface as a `constraint-moves` decision the dialog asks the
  user to accept or reject, because the user mapped those days deliberately;
- **discards any proposal that would break capacity** before showing it —
  `capacityOutranksConstraints` means the cut may not place anything outside
  working hours to satisfy a constraint;
- **reports rather than blocks**: a constraint no legal placement satisfies
  becomes a `constraint-violation` decision. The cut still proceeds.

Cross-week moves are deliberately out of scope. A constraint that could only be
satisfied by moving between weeks is reported as a violation.

`maxSolverPasses` (8) bounds the loop so a cyclic constraint graph terminates.

## Plan-then-confirm

The cut is a two-phase flow so the dialog can ask small questions one at a time
instead of presenting a switchboard.

1. `POST /api/gantt/curriculums/{id}/cut/plan` — runs the whole pipeline,
   **writes nothing**, and returns `report.decisions`.
2. The dialog walks the decisions one per screen, collecting answers.
3. `POST /api/gantt/curriculums/{id}/cut` — commits, carrying
   `acceptedConstraintMoves` and `weekOverflowResolutions`.

When the plan raises no questions the dialog commits immediately, so the common
case is still a single click.

## Preview

The Cut Preview tab runs the same pipeline as the real cut and highlights the
diff:

- relocated occurrences are outlined with a dashed warning-coloured border;
- generated breaks render as neutral filler rather than as lessons;
- the toolbar summarises how many events were rebalanced and how many breaks
  were added.

## Where things live

| Concern | File |
| ------- | ---- |
| Every tunable and the priority ladder | `ui/src/api-shared/gantt/cut-rules.ts` |
| Expansion, timing, materialization | `ui/src/api-shared/gantt/cut-planner.ts` |
| Spillover balancer | `ui/src/api-shared/gantt/cut-balancer.ts` |
| Break post-pass | `ui/src/api-shared/gantt/cut-breaks.ts` |
| Constraint solver | `ui/src/api-shared/gantt/cut-constraints.ts` |
| Server orchestration, Mongo/Postgres bridge | `ui/src/api-server/gantt/cut.ts` |
| Plan endpoint | `ui/src/app/api/gantt/curriculums/[id]/cut/plan/route.ts` |
| Dialog and decision steps | `ui/src/components/gantt/cut-dialog/` |
