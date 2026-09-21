# Bug Hunt — September 2026

A full read-through of the codebase (all four API layers, both component
trees, the cut pipeline, the Python CLI and the CI/seed scripts) done on
2026-09-17. Every finding below was verified against source before it was
fixed; findings that turned out to encode deliberate behaviour are listed at
the end with the reason they were left alone.

Verification after the fixes: `npm run typecheck` clean, ESLint clean on every
changed file, `npm run test:unit` 217 files / 2229 tests green (14 regression
tests added), `cli/` pytest 165 green, `ruff check` clean.

Severity legend: **critical** = data loss or security; **high** = a feature is
wrong for every user; **medium** = wrong under a common condition; **low** =
edge case or confusing failure.

---

## Critical

### 1. Undo after paging weeks deleted the visible week
`ui/src/components/schedule/calendar/calendar-provider/hooks/UseEventState.ts`

The undo stack survived a remote `SET_EVENTS` (week paging, iteration switch,
snapshot restore). `syncHistoryTravel` then diffed week B against a week-A
snapshot and pushed that diff to the server: every week-B event got an
`apiDeleteEvent`, every week-A event an `apiCreateEvent`.

**Fix:** a remote `SET_EVENTS` now resets `past`/`future`.

### 2. TLS verification forced off in production
`ui/src/instrumentation.ts`

`process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"` ran unconditionally at boot,
overriding the `.env` knob that `setup.py` writes, so every outbound TLS call
(Hive SSO token exchange, Google Calendar) accepted any certificate.

**Fix:** only set when not production *and* the variable is unset.

### 3. Module time allocation only applied to the first event
`ui/src/components/gantt/state/reducers/module-reducer.ts`,
`ui/src/api-shared/gantt/allocate-time.ts`

The reducer called the `async` `allocateTimeToModule`; only the first
iteration ran before the reducer returned, and the rest mutated
already-committed state with no re-render.

**Fix:** new synchronous `planModuleAllocation()` planner; the async wrapper
and the reducer both consume it.

---

## High

### 4. Prayer events written to the wrong iteration database
`ui/src/api-server/prayer.ts`, `ui/src/app/api/settings/[slug]/route.ts`

The settings route resolved the current iteration's controller for the
setting write, then called `updatePrayerEvents` without it, so prayer events
went to the legacy default DB. Found independently by two reviewers.

**Fix:** controller and iteration id threaded through every `DbEvent` call.

### 5. Prayer wall-clock read in server timezone
`ui/src/api-server/prayer.ts`, `ui/src/api-server/db-settings.ts`

`Date#getHours()` on a UTC container turned 06:00 Israel into 04:00 Israel.
Seeded defaults (`new Date(1970,0,1,18)`) had the same problem in reverse.

**Fix:** read wall-clock via `dayjs(...).tz(APP_TIMEZONE)`; seed defaults with
`dayjs.tz("1970-01-01 18:00", APP_TIMEZONE)`.

### 6. Snapshot restore failed on `_id`
`ui/src/api-server/db-calendar-snapshot.ts`

Captured events carried the client-echoed hex `_id` string; `replaceOne`
against a live ObjectId document threw "immutable field '_id' altered" and
aborted the whole restore. The "existing ids" read also sat outside the
transaction.

**Fix:** `_id` stripped from replacements; the read moved inside the
transaction with the session.

### 7. Curriculum import dropped most event data and all ordering
`ui/src/app/api/gantt/curriculums/import/route.ts`

Only `title/type/minimumDuration` were copied for events, and s2m/m2e
junction rows lost `sortOrder`. Recurrence, shuffles, lecturers, room
requirements vanished; module/event order collapsed.

**Fix:** rows go through `sanitizeCreatePayload` (full column set, enum
validation → 400), `sortOrder` carried, `hiveLessonId` nulled on the copy.

### 8. Hive room reservations never listed
`ui/src/app/api/reservations/route.ts`

Hive room ids are numbers in Mongo; the query string arrives as a string, so
the GET filter matched nothing. `roomSource=abc` also produced a NaN filter.

**Fix:** integer-literal ids coerced to number for Hive; unknown source is a 400.

### 9. Duplicate RealtimeStatus socket
`ui/src/components/base/RealtimeStatus.tsx`, `ui/src/components/auth/AuthProvider.tsx`

`useSessionWebSocketContext()` is the connection hook, not a reader. Calling
it a second time opened a second socket and a second `REGISTER_SESSION`.

**Fix:** `ws` passed as a prop from `AuthProvider`.

### 10. Failed personal-settings load wiped saved preferences
`ui/src/components/settings-dialog/tabs/PersonalSettings.tsx`

`.finally(() => setIsLoaded(true))` armed the persist effect after a failed
load, which then PUT the reducer defaults.

**Fix:** `isLoaded` is set only on success.

### 11. Offline: fetch failure indistinguishable from "no edits"
`ui/src/components/schedule/offline-dialogs/push-updates-dialog/index.tsx`

A failed `apiGetMultipleEvents` returned `{}`; the dialog closed and purged
the captured offline edits.

**Fix:** returns `null` on failure; caller re-enters offline mode without purging.

### 12. Offline: created-then-edited event classified as "modified"
`ui/src/components/schedule/calendar/calendar-provider/hooks/UseEventActions.ts`

Editing an event created offline captured a "before" copy, so reconciliation
tried `apiUpdateEvent` on an id the server never saw.

**Fix:** capture skipped when `isEventCreatedLocally(id)`.

### 13. Cleared outsider fields reappeared after reload
`ui/src/components/settings-dialog/tabs/global/outsider-settings/values.ts`,
`ui/src/api-shared/types/outsider.ts`

Blank fields mapped to `undefined`, which JSON drops, so the server `$set`
kept the old value.

**Fix:** blanks are sent as `null`.

### 14. Break pass pushed events into the pinned meal
`ui/src/api-shared/gantt/cut-breaks.ts`

Break slack was budgeted from the day's trailing tail, but the shift offset
reset at the pinned meal, so pre-meal events moved *into* lunch.

**Fix:** budgets computed per segment between pinned items. Regression test
reproduces the exact A/B/C/lunch/D scenario.

### 15. Cut rejected recurrences the Gantt showed as satisfied
`ui/src/api-shared/gantt/cut-planner.ts`

`isRecurrenceSatisfied` was called without `firstRequiredWeekIdx`, ignoring
`recurrenceStartDate` (#468) that the UI honours.

**Fix:** planner uses `getFirstRequiredRecurrenceWeekIdx` like `GanttEventRow`.

### 16. Gantt flagged satisfied constraints as violated
`.../gantt-view/use-gantt-violations.ts`

`c.maxDelayDays !== undefined && delta > c.maxDelayDays` — server rows carry
`null`, and `delta > null` is `delta > 0`. "before" also ignored min/max.

**Fix:** `!= null` checks; delta normalised per relation to match the solver.

### 17. Normalizer dropped `shuffles` and `dayEndTime`
`ui/src/api-client/gantt/drizzle-normalize.ts`, `.../UseWeekActions.tsx`

Reload emptied shuffle chips and blanked the day end-time input while the cut
still used the stored value.

**Fix:** fields carried through normalisation and the server-backed `ADD_DAY`.

### 18. Module shift moved mappings from other weeks
`.../gantt-view/use-gantt-drag.ts`

`linearDays.indexOf(dayId)` returned `-1` for another week's mapping and the
result was used as an index.

**Fix:** `-1` skipped in both directions.

### 19. Unlinking a syllabus crashed the module dialog
`ui/src/components/gantt/module-dialog/constraints/use-target-options.ts`

Orphaned modules dereferenced `state.syllabuses[m.syllabusId].title`.

**Fix:** modules without a syllabus are skipped.

---

## Medium

### 20. Drizzle journal non-monotonic → migrations 0002/0003 skipped
`drizzle/meta/_journal.json`

Drizzle applies an entry only when its `when` exceeds the last applied
`created_at`. `0001` (1781869848116) was newer than `0002`/`0003`
(1781524435371/2), so a DB migrated at `0001` never received the
`sort_order` and `archived` columns.

**Fix:** `0002`/`0003` bumped to `0001 + 1/2` (hashes unaffected).
**Operational note:** a database already past `0004` that is missing
`m2e.sort_order`/`s2m.sort_order`/`c.archived` still needs those two
migration SQL files applied by hand.

### 21. Hive lesson sync erased a hand-picked lesson
`ui/src/api-server/hive/lesson-sync.ts`

When the event no longer opened a queue, `reconcileEventLesson` returned
`null` and the caller `$set hiveLesson: null`, wiping the Segel's choice.

**Fix:** `deleteOwnedLesson` returns the id to keep; only a Bluz-owned lesson
is cleared.

### 22. `aiAssistantEnabled` could never be persisted
`ui/src/api-server/db-personal-settings.ts`

Missing from the field allow-list.

### 23. Course/room/outsider update bypassed the allow-list
`ui/src/api-server/db-courses.ts`, `db-rooms.ts`, `db-outsiders.ts`

`create*` used `pickFields`; `set*` spread the whole client payload into `$set`.

### 24. Settings GET cached for a day, `immutable`
`ui/src/app/api/settings/[slug]/route.ts`

Another user's change was invisible until the browser cache expired. The slug
was also never validated, so any key could be upserted and broadcast.

**Fix:** 60 s private non-immutable cache; slug must be a known `SettingName`.

### 25. Constraint PATCH ignored the target unless `type` was resent
`ui/src/app/api/gantt/curriculums/[id]/constraints/route.ts`

### 26. Duplicated event lost `shuffles`, shared `hiveLessonId`
`ui/src/app/api/gantt/events/[id]/duplicate/route.ts`

### 27. Rapid prayer-time edits reverted each other
`ui/src/components/base/SettingsProvider.tsx`

Payload built from a render-closure snapshot. **Fix:** `prayerTimesRef`,
mirroring the existing meal-settings ref.

### 28. Instructor move flagged its own source event as a conflict
`.../instructor-dnd/InstructorDndProvider.tsx`, `assign.ts`

### 29. Staff calendar localizer in browser timezone
`.../calendar/DndLocalizer.tsx`

Segments were computed in `APP_TIMEZONE` but rendered by a moment localizer in
device time; a non-Israel viewer lost segments crossing local midnight.
**Fix:** `moment.tz.setDefault(APP_TIMEZONE)`, as the student localizer does.

### 30. Date picker move across DST shifted the event by an hour
`ui/src/components/schedule/event-dialog/TimeFields.tsx`

### 31. Event type field kept the previous event's type
`ui/src/components/schedule/event-dialog/EventClassification.tsx`

`EventTypeField` seeded once; the dialog swaps `event.id` without remount.
**Fix:** `key={event?.id}`.

### 32. Course row kept a failed rename after rollback
`.../course-settings/CourseItem.tsx`

### 33. Week update had no stale-response guard
`.../gantt-funcs/UseWeekActions.tsx`

### 34. Constraint editor showed the literal string `"null"`
`ui/src/components/gantt/module-dialog/constraints/use-constraint-editor.ts`

### 35. Constraint solver reported pass-0 violations only
`ui/src/api-shared/gantt/cut-constraints.ts`

Violations fixed by a later pass stayed reported; ones broken later were dropped.
**Fix:** the final pass wins.

### 36. Split events never wrapped at day end
`ui/src/api-shared/gantt/cut-planner.ts`

Only the plain-stack branch wrapped; split events ran past `dayEnd`. Wrapped
events also skipped the meal-window bump.
**Fix:** shared `placeWithWrap` helper for both branches.

### 37. Holiday lookup off by one day west of UTC
`ui/src/api-shared/gantt/holidays.ts`

`new HDate(date)` reads local getters; callers pass UTC midnight.
**Fix:** re-anchor the UTC civil date at local midnight.

### 38. Reservations rendered in browser timezone
`ui/src/api-shared/types/reservation.ts`

`reservationDateFixup` used bare `dayjs()` while events use `.tz(APP_TIMEZONE)`.

### 39. Test pipeline exit codes
`scripts/demo/populate_demo_bluz.ts`, `scripts/run_tests.py`

Seed failures exited 0 (Playwright then ran on an empty DB); "Hive URL not
found" returned 0; `--grep`/`--spec` were interpolated unquoted into a shell
string. **Fix:** exit 1 paths, `shlex.quote`.

### 40. Release tagging: rc tags sorted above the final release
`scripts/publish.py`

`git tag --sort=-v:refname` without `versionsort.suffix` orders
`v1.0.0-rc.12` after `v1.0.0`. **Fix:** `-c versionsort.suffix=-rc`.

---

## Low

### 41. Iteration with only archived events undeletable
`ui/src/api-server/db-iterations.ts` — count excludes `archived: true`.

### 42. Lesson-activation tick warned every 30 s on a fresh install
`ui/src/api-server/hive/lesson-activation.ts` — uses `currentOrNull()`.

### 43. AI chat: non-object body was a 500
`ui/src/app/api/ai/chat/route.ts` — `requireJsonObjectBody`.

### 44. Constraint description crashed on a deleted owner
`ui/src/api-shared/types/gantt/models/constraint.ts` — optional chaining.

### 45. Malformed room resource key silently became a Custom room
`ui/src/api-shared/types/room.ts` — throws.

### 46. Room deep link (`?editRoom=`) no-op for Hive rooms
`.../room-settings/index.tsx` — string compare on `String(r.id)`.

### 47. CLI `logout` persisted env-derived config; `login` leaked `BLUZ_TOKEN`
`cli/bluz_cli/commands/auth.py` — file-only config for both paths, warning
when `BLUZ_TOKEN` is set.

### 48. `tools.py ci` traceback without `gh`
`scripts/tools_impl.py` — `FileNotFoundError` guard.

### 49. `import_hachnas.ts` empty connection string
`scripts/import_hachnas.ts` — env fallback outside the `catch`.

---

## Second pass (same day) — UI follow-ups

A second commit closed the remaining UI findings from the schedule/header/
settings review:

- **Iteration-scoped loads unsequenced** (`SettingsProvider.tsx`,
  `create-collection-provider.tsx`): a fast A→B switch let A's late response
  overwrite B's state and the refs the next save reads from. Generation
  token / sequence guard on every loader.
- **PersonalSettings PUTs raced**: chained so writes land in order.
- **Dark-mode branches were dead**: under MUI CSS-variable theming
  `theme.palette.mode` is always `"light"`; converted to
  `theme.applyStyles("dark", …)` across the settings dialog, instructor cards
  and calendar toolbar.
- **CourseItem indentation on the wrong edge**: physical `mr`/`borderRight`/
  `pr` flipped by stylis-rtl; now logical inline-start properties.
- **Keyboard Delete** clears the active event so a repeat cannot fire a
  second failing delete (`UseCalendarHandlers.ts`).
- **FilterIcon badge** ignored the staffing-gaps toggle.
- **NameUtils** unique prefix returned a trailing space.
- **AuthProvider fetch patch** restores only its own wrapper, keeps `this`.
- **ImportExport** revoked the object URL before the click.

## Reviewed and deliberately left alone

- **SSE unterminated tail** (`api-shared/sse.ts`): a trailing `data:` line
  without newline is dropped. The existing test documents this as intended
  (half a JSON document must not reach the consumer), matching the SSE spec.
- **Read-only when the iteration list fails to load**
  (`IterationProvider.tsx`): the test suite names this a "safe default".
- **`interval-layout.ts` zero-length segment**: callers (`layoutEnd`) assume a
  non-empty array; changing the contract is a wider refactor than the benefit.
- **`run_tests.py` random Postgres password on container reuse**, **`db:push`
  instead of migrate in the test pipeline**, **Google all-day event timezone**,
  **`setDbEvent` trusting client `updatedAt`**, **recurrence echo minutes
  missing from insights/weeks tab**, **`moveEvent` leaving mapping `moduleId`
  stale**, **unlink dispatching a delete action**: real but each needs a design
  decision or a schema/API change. Tracked here for follow-up.
