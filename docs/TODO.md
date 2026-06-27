# Bluz — Code Review & Production Sign-off TODO

> **Review date:** 2026-06-18 · **Branch:** `dev` · **Reviewer:** Claude (Opus 4.8)
> **Scope:** Full codebase audit — security, correctness, SOLID/DRY, and React / Next.js /
> MUI / Tailwind best practices. Findings below were produced by a multi-angle review and
> the **Critical/High items were individually verified against source** (marked ✔︎).

## Sign-off verdict: 🟡 Close — fix the reliability & correctness blockers

> **Threat model (updated 2026-06-18):** Bluz is deployed **only on secure, air-gapped
> networks with no malicious actors.** Network-borne security risks — MITM, anonymous API
> abuse, eavesdropping — are therefore **out of scope**, and the `[SEC]` findings have been
> re-rated **down** accordingly (see **🔒 Security (de-prioritized)** near the bottom). What
> remains are **functional** blockers: correctness, reliability, and observability bugs that
> show up in normal multi-user use and need no attacker to bite.

Bluz is well-architected (clean layering, good per-directory docs). The must-fix items before
clients use it are now a short, non-security list:

1. **Realtime sync silently dies and loses data** — no WS reconnection, dropped offline
   updates, and optimistic-vs-broadcast races lose edits between *legitimate* users.
2. **`HiveClient` hangs forever on a Hive 5xx** — a request worker can wedge with no attacker
   involved. (verified)
3. **Two silent correctness bugs** — the Gantt reducer mutates state in place, and
   allocated-duration is filtered by the wrong id so it always reads empty. (verified)
4. **Placeholder English mock data** ships in a user-facing settings tab of a Hebrew product.
5. **CI publishes images that were never tested** (lint-only gating).

Total (re-rated): **6 functional blockers · ~14 High · ~18 Medium · ~12 Low** + cross-cutting
refactors. Security items are retained at reduced severity — a few are cheap hygiene wins
worth doing anyway, and one (disabled TLS) is **likely intentional** for self-signed Hive on a
closed network.

**Legend:** `[SEC]` security · `[BUG]` correctness · `[PERF]` performance · `[RT]` realtime ·
`[INFRA]` infra/build · `[DX]` best-practice/cleanup · ✔︎ = personally verified against source.
**`[SEC]` items are re-rated down under the air-gapped threat model** — see the verdict note
and the 🔒 Security section. Items with a non-security tag keep their original severity.

---

## 🔴 Critical — deployment blockers

> 🔒 The security findings that depended on a malicious actor — unauthenticated API, disabled
> TLS, committed test creds, token logging, `NEXTAUTH_SECRET` guard — have moved to
> **🔒 Security (de-prioritized — air-gapped)** below, at reduced severity. Only the
> *reliability* slice of the WebSocket issue stays here, since it bites without an attacker:

- [ ] **[RT] WS sync server can crash on a malformed frame (reliability, not security).**
  `session-server/session-server.ts` does `JSON.parse(dataString)` (~line 166) with no
  try/catch. A truncated or garbled frame from a *legitimate* client or a flaky link throws in
  the message handler and can take the sync server down **for everyone** — no attacker needed.
  The connection registries also grow unbounded.
  **Fix:** Wrap parsing in try/catch, validate `type` against `MessageTypes`, ignore unknown
  frames; bound/expire `connectedSessions` / `registeredSyncObjectConnections`.

- [ ] **[BUG] ✔︎ `HiveClient._get` recurses forever on HTTP 500.**
  `ui/src/api-server/hive/client.tsx:86-89` sleeps 200ms then `return await this._get(url, isRetry)`
  with no attempt counter (the `isRetry` flag only guards the 401 path).
  **Impact:** A persistently-5xx Hive endpoint pins a Next.js request worker in an unbounded
  async loop that never returns and never errors — resource exhaustion / hang.
  **Fix:** Add a bounded retry counter (2-3) with backoff, then throw `HiveClientError`.
  Bound the 401→refresh path too.

- [ ] **[BUG] ✔︎ Reducer mutates existing state in `ALLOCATE_TIME_TO_MODULE`.**
  `ui/src/components/gantt/state/reducer.ts:238` does `const updatedEvents = state.events;`
  then writes `updatedEvents[eventId] = {...}` into the live object, and returns
  `{ ...state, events: updatedEvents }` (same reference). (`ALLOCATE_TIME_TO_EVENT` just above
  does it correctly with `...state.events`.)
  **Impact:** In-place state mutation — memoized selectors comparing `state.events` by
  reference see no change → stale UI; optimistic rollback/undo becomes unreliable.
  **Fix:** `const updatedEvents = { ...state.events };` before writing.

- [ ] **[RT] WebSocket client never reconnects.**
  `ui/src/components/SessionWs.tsx:81` — `socket.onclose = () => console.log("ws closed")`; no
  reconnect/backoff anywhere, and `ws.current` is never reset to `null` on close. ✔︎
  **Impact:** Any network blip, server restart, or laptop sleep permanently kills realtime
  sync for the session; clients silently diverge until a full page reload.
  **Fix:** On close/error, schedule reconnect with exponential backoff, recreate the socket,
  re-run `registerCurrentSession()`, re-flush the queue; surface connection state in the UI.

- [ ] **[RT] Incoming updates are dropped while offline with no replay.**
  `schedule/calendar/calendar-provider/hooks/UseEventWebsocket.ts:22` — `if (offlineMode) return;`
  discards every `EVENT_DATA_UPDATE`/`EVENT_ADDED_OR_REMOVED`. On exit, only the user's *edited*
  ids are re-fetched, so others' concurrent changes never appear.
  **Impact:** Stale/incorrect calendar after any offline session; concurrent deletes/creates
  by other users are invisible indefinitely.
  **Fix:** Buffer-and-replay messages received while offline, **or** force a full
  `loadEvents(startDate, endDate)` refetch when leaving offline mode.

- [ ] **[DX] ✔︎ Placeholder English mock data ships in a user-facing settings tab.**
  `settings-dialog/tabs/PersonalSettings.tsx:36-49` — `ALL_GROUPS = ["Group A"…"Group E"]`,
  `ALL_INSTRUCTORS = ["Alice"…"Emma"]` rendered into a live tab of a Hebrew/RTL product.
  **Impact:** Users see fake English groups/instructors. Sign-off blocker.
  **Fix:** Source groups/instructors from the Hive providers (as `course-settings` does via
  `useHiveUsers`); delete the mock arrays.

- [ ] **[INFRA] CI publishes images with no test gating.**
  `.github/workflows/release-pipeline.yml` build jobs only `needs: lint`; `e2e.yml` is
  `workflow_dispatch` only and `vitest` runs nowhere in the gating path.
  **Impact:** Lint-clean-but-broken code is built and pushed to GHCR / release bundles
  untested.
  **Fix:** Add a `test:unit` job as a `needs` prerequisite for the build jobs; run e2e on
  PR/merge (or nightly), not manual-only.

---

## 🟠 High

- [ ] **[BUG] All API errors return HTTP 200 (breaks observability & client error handling).**
  `api-server/common.tsx:64-92` (`ApiErrorMaker`) hardcodes `status: 200` with
  `{ status:-1, error:{ name, message, status } }`; `catchHandler` routes unknown errors
  through it, and `UserNotLoggedInError` → `NextResponse.error()` (500, not 401).
  **Impact:** Independent of any threat model — a DB/Hive outage looks like `200 OK` to ops
  tooling, retries, caches, and load balancers; clients must parse the body to detect failure;
  auth failures are indistinguishable from server errors. Stays High.
  **Fix:** Map error classes to real status codes (401/400/500); generic message for
  unexpected errors, log details server-side only.

- [ ] **[BUG] ✔︎ Allocated-duration filtered by the wrong id in entity fetches.**
  `db-module-event.ts:48`, `db-module.ts` (`getFullModule`), `db-syllabus.ts` (`getFullSyllabus`)
  load nested `cEC` with `where: eq(c.curriculumId, id)` where `id` is the **event/module/
  syllabus** id (never a curriculum id). (`db-curriculum.ts:55` does this correctly.)
  **Impact:** `cEC` always resolves empty → any UI reading allocated time from a single
  module/event/syllabus GET shows 0/empty. Silent data-correctness bug. The param is even
  typed `GanttModuleId` while an event id is passed.
  **Fix:** Pass the curriculum context explicitly and filter on it, or drop the per-curriculum
  `cEC` filter from entity-scoped fetches.

- [ ] **[BUG] `createWeek` writes a week + 7 days across 8 separate transactions.**
  `api-server/gantt/db-week.ts:61-96` — week insert (own txn), then `Promise.all` of seven
  `DbDay.createNewItem` (each its own txn); no enclosing transaction.
  **Impact:** A mid-loop failure/crash leaves a persisted week with 0-6 days and orphaned `w2d`
  rows — a structurally invalid curriculum week with no rollback.
  **Fix:** Wrap week + all day inserts in one `postgresDb.transaction(...)`.

- [ ] **[BUG] Unbounded, unvalidated event range query.**
  `api-server/db-event.ts` `getInRange` has no `limit`; `api/event/route.tsx:57-62` passes
  `new Date(rawStartDate)`/`new Date(rawEndDate)` straight from query params (no `NaN` check).
  **Impact:** A multi-year range pulls the whole events collection into memory (DoS); an
  invalid date yields `Invalid Date` → silently wrong/empty results instead of a 400.
  **Fix:** Validate parsed dates, cap the span, paginate/limit the cursor.

- [ ] **[RT] Optimistic save races the WS broadcast / server echo (lost updates).**
  `schedule/.../hooks/UseEventActions.ts:32-47` dispatches `UPSERT_EVENT` optimistically, again
  on resolve, while the server also broadcasts `EVENT_DATA_UPDATE` to this client — no
  version/sequence guard, and self-broadcasts aren't filtered by `initiatorKey`.
  **Impact:** A concurrent update landing between optimistic dispatch and promise resolution is
  overwritten by stale data; visible flicker on every save.
  **Fix:** Add `updatedAt`/version and ignore stale upserts; ignore self-originated broadcasts
  via `initiatorKey`; drop the redundant post-resolve upsert when unchanged.

- [ ] **[RT] `UPSERT_EVENT` reorders the events array on every edit.**
  `UseEventState.ts:19-23` — `[...state.filter(e => e.id !== id), action.payload]` moves the
  edited event to the end.
  **Impact:** react-big-calendar re-keys/re-mounts on reorder → flicker, lost drag state,
  full-grid re-render per edit.
  **Fix:** Replace in place (map), append only when the id is new.

- [ ] **[RT] WebSocket/remote updates pollute undo/redo history.**
  `UseEventState.ts:38-58` routes optimistic edits, server echoes, **and** remote WS upserts
  through the same `useHistoryState` setter.
  **Impact:** Ctrl+Z can "undo" another user's change or the server's authoritative echo,
  resurrecting ghost events; history grows unbounded with every broadcast.
  **Fix:** Route remote/echo updates through a non-history setter; only local user intent
  pushes history.

- [ ] **[RT] Partial offline-push failure leaves a split-committed state.**
  `schedule/offline-dialogs/push-updates-dialog/index.tsx:78-143` awaits delete/create/update
  sequentially; a mid-loop throw leaves earlier writes committed server-side while the dialog
  re-opens with the original full set.
  **Impact:** Re-submit re-sends already-applied ops (duplicates, or errors on already-deleted
  ids); user can't tell what synced.
  **Fix:** Bulk/atomic server endpoint, or track per-event success and retry only the
  remainder; reconcile `collisionStates` after partial failure.

- [ ] **[RT] Offline baseline snapshots a moving target.**
  `base/OfflineProvider.tsx:82-94` + `calendar-provider/index.tsx:29-33` capture the baseline on
  every `events` change while offline (only for not-yet-captured ids), so locally-created/edited
  events become their own "baseline."
  **Impact:** Real conflicts get classified as non-conflicting and silently overwrite server
  changes on push (lost updates).
  **Fix:** Capture the baseline exactly once at the online→offline transition, from the
  authoritative list, before any edits.

- [ ] **[PERF] Context value objects recreated every render (whole-tree re-renders).**
  Un-memoized provider `value={{…}}` objects: `gantt-view/GanttView.tsx:405` (`GanttContext`),
  `schedule/calendar/calendar-provider/index.tsx:69-82` (`CalendarContext`),
  `base/RoomsProvider.tsx:391`, `base/CoursesProvider.tsx:296`.
  **Impact:** Every consumer re-renders on any unrelated state change in the provider — the
  most expensive views (Gantt grid, calendar grid) re-render on every keystroke/WS message.
  **Fix:** Wrap each value in `useMemo` over its real dependencies (handlers are already
  `useCallback`-stable).

- [ ] **[PERF] O(n·m) lookups in the Gantt render path.**
  `gantt-view/GanttView.tsx:82-186` and `GanttModuleRow.tsx:50-100` call `linearDays.indexOf`,
  `timelineWeeks.findIndex(... .includes(dayId))` inside per-module/per-event loops;
  `curriculum-view/gantt-time-utils.ts:135-174` `getScheduledMinutesForDay` reduces over **all**
  mappings once per `DayCapacityCell` (`WeeksCapacityGrid`).
  **Impact:** O(modules×days)…O(days²) recomputed on every mapping change/drag → visible jank.
  **Fix:** Precompute `Map<dayId, index>` / `Map<dayId, weekIndex>` and a
  `Record<dayId, scheduledMinutes>` once (memoized), pass via context; replace scans with O(1)
  lookups.

- [ ] **[PERF] WS update triggers a full collection refetch (thundering herd).**
  `RoomsProvider.tsx:373-388` / `CoursesProvider.tsx:278-293` call `loadRooms()`/`loadCourses()`
  on every `*_UPDATE`, ignoring the payload; optimistic CRUD also re-`load`s after dispatch.
  **Impact:** N clients each GET the entire collection on every single edit; the post-mutation
  reload races and can reintroduce stale data.
  **Fix:** Apply the WS payload incrementally via the reducer; drop the redundant post-mutation
  reload (or sequence it).

- [ ] **[INFRA] Standalone image copies the full `node_modules`.**
  `ui/Dockerfile:43` `COPY --from=builder /app/node_modules ./node_modules` on top of
  `output: "standalone"` tracing (`next.config.ts:9`).
  **Impact:** Much larger image / slower pulls; defeats standalone tracing; makes
  `outputFileTracingIncludes` guesswork.
  **Fix:** Rely on `.next/standalone`; copy only `migrate.js` + its needed modules; verify
  `drizzle-orm`/`pg` are traced.

- [ ] **[INFRA] No DB healthchecks; app starts before databases are ready.**
  `docker-compose.yml` defines no `healthcheck`/resource limits on Postgres/Mongo; `ui`
  `depends_on` is plain. `run_tests.py` masks this with a 15× retry loop, and the test pipeline
  even runs `db:generate` (mutating committed migrations — violates AGENTS.md §7).
  **Impact:** Cold-start races (migrations hit a not-ready DB); no memory caps (host OOM risk);
  non-reproducible test runs.
  **Fix:** Add `pg_isready`/`mongosh` healthchecks + `condition: service_healthy` +
  `deploy.resources.limits`; in tests run `db:push`/apply migrations only, never `db:generate`.

---

## 🟡 Medium

- [ ] **[BUG] Request bodies are cast, not validated (fails on legit malformed input).** `api/gantt/base-collection.ts:60`,
  `base-item.ts`, `base-link.ts`, `curriculums/import/route.ts`, `[id]/mappings` & `constraints`
  PATCH all do `await request.json() as T` with no shape/enum/size validation before DB writes.
  Missing `notNull` columns surface as raw Postgres errors (returned as 200). **Fix:** validate
  with zod at the route boundary; reject with `ClientApiError` (400). Cap import depth/node count.
- [ ] **[BUG] PATCH/DELETE deref unguarded body fields.**
  `api/gantt/curriculums/[id]/mappings/route.ts:91,118` reads `oldMapping.dayId` before
  guarding `oldMapping` existence → `TypeError` on malformed body. **Fix:** `!oldMapping ||
  !oldMapping.dayId`; validate body presence first.
- [ ] **[BUG] No-op saves reported as errors.** `db-courses.ts:24` / `db-rooms.ts:24` throw when
  `modifiedCount === 0` (saving without changes), while `db-event.ts:93` correctly uses
  `matchedCount`. **Fix:** use `matchedCount`; don't treat unchanged saves as failures.
- [ ] **[BUG] `prayer.ts` mutates the caller's `Date` and mis-handles first-time creation.**
  `updatePrayerEvents` (`prayer.ts:127`) calls `startDate.setHours(0,0,0,0)` on the passed-in
  Date; `updatePrayerEventsInDay` (~56-118) computes off a stale `prayerEvents` array so the
  first-time create path never time-adjusts and broadcasts an empty list; concurrent calls can
  create duplicate prayer sets. **Fix:** clone the date; operate on the created events; idempotent
  upsert keyed on `(day, prayerType)`; serialize per-day.
- [ ] **[BUG] Fire-and-forget WS broadcast opens a new socket per call and swallows failures.**
  `api-server/web-socket-utils.tsx:27-50` sends in `onopen`; if the server is down the message is
  dropped after the DB write already committed. **Fix:** pooled/persistent connection with
  reconnect; surface failures (metric/log with message id).
- [ ] **[BUG] `moveMapping` depends on `state.mappings`, churning the mappings context.**
  `gantt/state/mappings/Provider.tsx:92-146,191` — the callback is in the memoized value's deps,
  so the whole mapping context value changes identity on every mapping mutation. **Fix:** read
  current mappings from a ref; keep deps `[curriculumId, enqueueSnackbar]`.
- [ ] **[BUG] Mappings refresh effect has no abort/mounted guard (curriculum-switch race).**
  `mappings/Provider.tsx:31-35,181` dispatches a stale fetch result into the new curriculum's
  state. **Fix:** request token / `AbortController`; ignore stale resolutions.
- [ ] **[BUG] `ADD_WEEK` reducer case lacks the parent guard its siblings have.**
  `gantt/state/reducer.ts:383` reads `state.curriculums[curriculumId].weeks` unguarded → throws on
  a stale id. **Fix:** `const parent = state.curriculums[curriculumId]; if (!parent) return state;`.
- [ ] **[BUG] `UPDATE_WEEK` payload typed `any`, spreads raw server shape into normalized state.**
  `reducer.ts:113` + `UseWeekActions.tsx:99` dispatch the full `GanttWeek` (incl. `w2d`) into the
  normalized week. **Fix:** type as `Partial<GanttWeek>`; dispatch only intended fields.
- [ ] **[BUG] Week filter is dead code; mappings over-fetch + missing index.**
  `db-mappings.ts:24-52` accepts `_weekIds` but the filter is commented out (TODO); `cMDA` has no
  index beyond the unique constraint. **Fix:** implement or remove the param; index
  `cMDA.curriculum_id` (and `day_id`).
- [ ] **[PERF] `WeeksCapacityGrid` keys encode mutable data → remount per edit.**
  `WeeksCapacityGrid.tsx:231,526` keys row/cell by `comment`/`totalWorkingMinutes`/`weekendDuty`,
  forcing full unmount/remount (losing focus) on every committed change — and papering over the
  derived-state bug below. **Fix:** key by stable identity (`week.id`, `dayId`); reconcile local
  editable state explicitly.
- [ ] **[BUG] Derived editable state never reconciled.** `DayCapacityCell.tsx:84-87` seeds
  `localTime`/`localComment` from props only on mount; the `DayHeaderCell` bulk update doesn't
  reflect until the key-remount hack fires. **Fix:** sync via effect on the source value (guard
  focus), or remount intentionally by stable key.
- [ ] **[DX] `localStorage` read during render.** `WeeksCapacityGrid.tsx:267` (`DayHeaderCell`
  `initialMinutes` inside `useMemo`) reads `localStorage` in the render phase → hydration-mismatch
  risk. **Fix:** lazy `useState` initializer / `useEffect`, guarded by `typeof window`.
- [ ] **[DX] ✔︎ `localStorage.setItem` inside a reducer.** `PersonalSettings.tsx:101-106` — impure
  reducer; double-writes under StrictMode/concurrent. **Fix:** persist in a `useEffect([state])`.
- [ ] **[RT/BUG] Date/timezone handling lacks UTC/DST safety.** `api-shared/calendar.ts:6-31`
  (`eventDateFixup`) and `schedule/.../UseCalendarHandlers.ts:64` use bare `dayjs(value)`/`new
  Date(value)` with no UTC/timezone plugin; week range relies on a `moment.locale("he")` import
  side-effect (`schedule/calendar/utils.ts` + `DndLocalizer.tsx`, flagged "DO NOT SORT IMPORTS").
  **Impact:** Israel DST transitions can shift dragged/displayed events by an hour; import-order
  fragility can mis-fetch the edge week. **Fix:** standardize on UTC + dayjs timezone plugin;
  pass explicit `firstDayOfWeek`/locale instead of a global side-effect.
- [ ] **[BUG] `areValuesEqual` treats any parseable string as a date.**
  `schedule/types/EventUtils.ts:44-49` accepts `"5"`, ids, etc. via `Date.parse`/`dayjs`, so the
  conflict-diff engine may compare name/notes as timestamps → wrong conflict classification.
  **Fix:** only treat known date keys / real `Date`/`Dayjs` instances as dates.
- [ ] **[BUG] Resource matching by `JSON.stringify`.** `schedule/calendar/calendar/CalendarView.tsx:171`
  matches rooms via `JSON.stringify(room)` equality (property-order/extra-field fragile) → events
  silently fall into the "no room" column. **Fix:** match on a stable composite key `${source}:${id}`.
- [ ] **[RT] Collision-check effect re-runs on every `localEvents` change while the dialog is open.**
  `push-updates-dialog/index.tsx:209-244` refetches and resets `selectedIds` mid-review on any WS
  message. **Fix:** run once on open (ref/flag), abort in-flight requests, preserve selection.
- [ ] **[DX] Global `window.fetch` monkey-patch for auth logging.** `auth/AuthProvider.tsx:48-84`
  overwrites `window.fetch`; the queue-flush effect (`:127`) gates on `ws.current` at first render
  and may never re-run, dropping queued messages. **Fix:** use next-auth error events; centralize
  socket open/close/queue in `SessionWs`; don't patch global fetch.
- [ ] **[DX] `useSearchParams()` without a Suspense boundary.** `gantt/page.tsx:89` (only ancestor
  is a provider layout). **Impact:** `missing-suspense-with-csr-bailout` — build can fail / whole
  route deopts to client. `login/page.tsx:120` does this correctly. **Fix:** extract the
  param-reading child and wrap in `<Suspense>`.
- [ ] **[DX] Theme rebuilt per toggle + dark-mode FOUC.** `theme/ThemeProvider.tsx:97-112` rebuilds
  `createTheme` on every change and gates on `mounted` (first render always light) even though
  `cssVariables` is enabled. **Fix:** build both color schemes once via `colorSchemes` and switch
  by the `class` selector already configured (`colorSchemeSelector:"class"`).
- [ ] **[INFRA] Session server ships TS + sources to prod and may bake `.env`.**
  `session-server/Dockerfile.websocket:20` runs `npx tsx session-server.ts` (TS JIT in prod) with
  `COPY . .`; `.dockerignore:16` only excludes `.env*.local`, so a root `.env` enters the build
  context of both images (UI Dockerfile sets `check=skip=SecretsUsedInArgOrEnv`). **Fix:** precompile
  to JS + run with `node`; add `.env`, `.env.*`, `nginx/ssl/` to `.dockerignore`; remove the check-skip.
- [ ] **[INFRA] E2E is non-hermetic.** `e2e.yml:43-67` depends on a real `https://hive.org` + the
  hardcoded `admin:Password1`, and the readiness loop `break`s without failing on timeout.
  **Fix:** ephemeral/mock Hive per run; inject pre-baked `.auth/user.json` from a secret; fail on
  timeout.
- [ ] **[INFRA] Test stack tests a non-prod image.** `docker-compose.test.yml` builds `target: dev`
  then runs `build && start` with `--no-mangling` — structurally different from the real `runner`
  stage (deps, root user, source present). **Fix:** build/test against the `runner` target.

---

## 🟢 Low / polish

- [ ] **[DX] Leftover `console.log` in hot paths.** `api-client/gantt/drizzle-normalize.ts:161`
  (`console.log(store)` — logs the whole curriculum store on every load), `SessionWs.tsx:59`,
  `AuthProvider.tsx:103`, `BluzCalendar` navigation handlers. Remove or gate behind a debug flag.
- [ ] **[SEC] WS client identity is a random UUID, not the authenticated user.** `SessionWs.tsx:69`
  `initiatorKey: crypto.randomUUID()` — server can't bind connections to users for authz/audit.
  Derive server-side from the validated JWT.
- [ ] **[SEC] Internal `ws://` link carries the shared auth key in cleartext.**
  `session-common.ts` / `web-socket-utils.tsx:36` — single static, non-rotated secret over
  `ws://bluz-sessions:28199`. Fail fast if unset; use TLS/network isolation; rotate.
- [ ] **[DX] `case` blocks declare `const` without braces.** `gantt/state/constraints/reducer.ts:19`,
  `mappings/reducer.ts:16` — `no-case-declarations` footgun (curriculum reducer braces every case).
  Wrap each `case` body in `{ }`.
- [ ] **[DX] `setTimeout` debounce ref never cleared on unmount.** `course-settings/CourseItem.tsx`
  `colorTimeoutRef` (set ~:129) has no cleanup → a write can fire after unmount. Add a cleanup effect.
- [ ] **[DX] `as any` / `Array<any>` defeat MUI + domain typing.** `PersonalSettings.tsx:249`
  (`color={colorTheme as any}`), `course-settings/index.tsx:64,77` (`Array<any>` overlay props).
  Type as `ChipProps["color"]` / the real `Course`/`CourseUser`.
- [ ] **[DX] Derived-state reset via render-phase `setState` for 7 fields.** `OutsiderForm.tsx:62-74`
  — prefer `key={selectedOutsider?.id ?? "new"}` on the form to remount with fresh `useState`.
- [ ] **[DX] `nullable` vs `default("")` inconsistency for comment/description.** `schema/days.ts:11`
  (`comment` nullable) vs weeks/curriculums/modules (`notNull().default("")`). Pick one convention.
- [ ] **[DX] Confusing duplicate schema export alias.** `gantt/schema/index.ts:26-33`
  (`...ModuleDayMappingsSchema` aliases `...EventDayMappingsSchema`) — works, but is a DRY/clarity
  smell relied on by `db-mappings.ts:47`. Consolidate to one name.
- [ ] **[INFRA] Husky hook ignores the configured `lint-staged`.** `.husky/pre-commit` runs
  `eslint --fix ui/` + `ruff` across the whole tree (mutating unstaged files) instead of
  `npx lint-staged`. Slow + can restage unrelated changes; contradicts AGENTS.md §5.
- [ ] **[INFRA] Dependency hygiene.** `react-color@^2` (unmaintained, React 19 peer mismatch) +
  `mui-color-input` (two color pickers); `@base-ui/react` alongside full `@mui/material` (two
  component systems); `next-auth@4` (maintenance) on Next 16 / React 19; session-server on EOL
  `eslint@8`; broad `^` ranges on `mongodb@7`/`next@16`/`react@19`. Plan a next-auth v5/Auth.js
  migration; consolidate pickers/UI libs; pin the runtime-critical stack.
- [ ] **[DX] Root `README.md` was a stub** — now replaced; keep it and `AGENTS.md` in sync as the
  above issues are resolved (e.g. the "two databases" note, the auth model once middleware lands).

---

## ♻️ Cross-cutting refactors (SOLID / DRY)

- [ ] **Extract a generic collection-provider factory.** `RoomsProvider` (~415 lines),
  `CoursesProvider` (~320), and the outsiders provider are near-identical optimistic-CRUD-with-
  rollback reducers + a WS-reload handler. The un-memoized-value and refetch-on-WS bugs were
  copy-pasted across all of them. Factor a `createCollectionProvider({ api, actions })`.
- [ ] **Collapse the five `Use*Actions` Gantt hooks.** `gantt/state/hooks/gantt-funcs/Use{Module,
  ModuleEvent,Syllabus,Week,Curriculum}Actions.tsx` repeat ~25 near-identical
  `withGantErrorHandling(async () => { const x = await api…; dispatch({type,payload}); return x; })`
  blocks. Factor `makeEntityActions(api, dispatch, {add,update,remove})`; bugs currently must be
  fixed in five places.
- [ ] **Extract a shared settings form.** `OutsiderForm` (~560), `RoomFormCard` (12-prop drill +
  `RoomBasicDetails`/`ExtendedDetails`/`Actions`), `CourseItem` (~533), and `PersonalSettings`
  (~446) re-implement "controlled field + trim + validate + snackbar" and the same card-surface
  `sx` (border/`borderRadius:"16px"`/brand `boxShadow`) ~4 ways. Extract a `useEntityForm` hook +
  a `<SettingsCard>` / styled `TextField`; co-locate room form state inside `RoomFormCard`.
- [ ] **Split the god-components.** `BluzCalendar` (`schedule/calendar/calendar/index.tsx`, ~339)
  mixes fullscreen chrome, toolbar toggles, filter indicators, keyboard handling, and date-range
  orchestration; `GanttView` (~533) owns `showConstraints` that only the overlay needs (it forces
  the whole tree to re-render — lift `ConstraintLines` + the switch into a sibling). Several files
  exceed ~500 lines (`OutsiderForm`, `WeeksCapacityGrid`, `DayCapacityCell`, `CourseItem`).

---

## 🎨 Best-practice cleanups (MUI / Tailwind / Next / RTL)

- [ ] **Theme tokens, not literals.** `theme/CreateFromPalette.ts:150-160` hardcodes AppBar/Dialog
  colors (`rgba(173,226,238,0.29)`, `#0D2336`, `#0C2237`…) that already exist as
  `background.paper`/`text.primary`/`divider`; `course-settings` hardcodes brand `#67C8DD`
  (= `primary.main`) and `rgba(0,0,0,0.15)` borders (invisible in dark mode). Reference
  `theme.vars.palette.*`.
- [ ] **Drop 39 redundant `fontFamily: "Assistant, sans-serif"` `sx` overrides** across 12
  settings-dialog files — `typography.fontFamily` already sets it globally (`CreateFromPalette.ts:71`).
- [ ] **Fix physical directions in the RTL app.** `course-settings/index.tsx:431`,
  `RoomListCard.tsx:148`, `OutsidersList.tsx:349` use Tailwind `ml-1` on `startIcon`;
  `(with-hive)/layout.tsx:62-72` uses `left: 24` on the offline FAB. Use logical `ms-/me-` /
  `insetInlineStart` (AGENTS.md §7).
- [ ] **Avoid layout reads during drag.** `course-settings/index.tsx:43-57` `dialogOffsetModifier`
  does `document.querySelector(".MuiDialog-paper")` + `getBoundingClientRect()` per pointer move
  (forced reflow + brittle MUI-internal class). Capture the rect once on drag start via a ref.
- [ ] **Verify the layout→client env hand-off.** `app/layout.tsx:19-21` reads
  `process.env.WEBSOCKET_SESSION_SERVER_HOST` and `@/settings` exports, then passes them into a
  client provider — confirm only browser-safe values cross the boundary (source the WS host from a
  `NEXT_PUBLIC_` var, consistent with `NEXT_PUBLIC_HIVE_URL`). Also fix the `wsProtcol` typo.
- [ ] **Memoize the data into react-big-calendar.** `calendar-provider/index.tsx` passes the raw
  `useHistoryState` array straight to `DnDCalendar`; derive the filtered, view-scoped list with
  `useMemo` (a `CalendarFilterProvider` already exists) so WS broadcasts outside the view don't
  re-lay-out the grid.

---

## 🔒 Security (de-prioritized — air-gapped, no malicious actors)

> Under the stated threat model these are **not** deployment blockers. Kept for the record and
> re-rated for a trusted, air-gapped network. The cheap ones are still worth doing as hygiene;
> one is likely intentional. **If the deployment assumption ever changes** (any untrusted client
> can reach the app or the session server), these revert to Critical/High — the original
> ratings are in git history.

- [ ] **[SEC ↓ Medium — feature/audit gap, not a security hole] No auth on API routes.** ✔︎ No
  `ui/middleware.ts`; the Gantt + calendar routes never check a session (only the Hive-proxy
  routes do, via `createHiveClient`). *Air-gapped:* the anonymous-attacker risk is moot — **but**
  the `Segel`/`Admin` **clearance gate** in `sso.ts` and per-user **edit attribution** are real
  product requirements that go unenforced for direct API calls. Worth a `getToken` check (or a
  `middleware.ts`) for correctness/auditing even internally; lower urgency than the functional
  blockers. **Fix:** add the JWT check in `buildGant*Routes` + the calendar handlers.
- [ ] **[SEC ↓ Low — likely intentional] TLS validation disabled.** `instrumentation.ts:6`,
  `setup.py:276`, `verify=False` in the Python scripts. *Air-gapped:* MITM is out of scope, and
  this is probably **deliberate** so the server accepts Hive's self-signed cert on a closed
  network. If so, **leave it but document it** (ideally scope to non-prod, or trust the Hive CA
  via `NODE_EXTRA_CA_CERTS` so a real cert still validates). No security action required.
- [ ] **[SEC ↓ Low — repo hygiene, network-independent] Committed test DB credentials.**
  `docker-compose.test.yml:19-20` (+ fallback in `run_tests.py:292`). The deployment network
  doesn't matter here — these sit in a repo published to GHCR. If the repo is hosted anywhere,
  rotate them and move to `${TEST_*}` from CI secrets. Otherwise low.
- [ ] **[SEC ↓ Low — hygiene] Token / OAuth metadata logged.** `sso.ts:194` (`debug:true` +
  `JSON.stringify(metadata)`) and `avatars/[slug]/route.tsx:34` (`console.log(accessToken)`).
  *Air-gapped:* low leak risk, but it's log noise and a verbose debug flood. **Cheap fix:** gate
  `debug` on `NODE_ENV !== "production"` and delete the avatar log line.
- [ ] **[SEC ↓ Low — ops robustness] No `NEXTAUTH_SECRET` startup assertion.** `sso.ts` never
  asserts it (unlike `getJwtSecret()`). Forgery risk is low on a closed network, but a **missing**
  secret breaks auth functionally — a fail-fast guard is a cheap reliability win.
- [ ] **[SEC ↓ Low/None — actor-dependent] The rest.** No nginx security headers/HSTS; avatar
  proxy SSRF via unvalidated `slug` + token-as-Cookie (`avatars/[slug]/route.tsx:31,41`,
  `client.tsx:104`); WS handshake accepts unauthenticated clients; internal `ws://` carries the
  shared auth key in cleartext (`web-socket-utils.tsx:36`); WS client id is a random UUID, not
  the authenticated user (`SessionWs.tsx:69`). All require a hostile actor on the network → out
  of scope under the air-gapped assumption. Revisit only if Bluz is ever exposed beyond the LAN.

---

## ✅ What's already solid (so we don't regress it)

- Clean four-layer API split (`api-client`/`app/api`/`api-server`/`api-shared`) with enforced
  server/client boundaries and good per-directory READMEs.
- `buildGant*Routes` generation keeps Gantt CRUD DRY (just add the auth/validation it's missing).
- Mappings/constraints optimistic-update **rollback** flows are sound.
- DB singletons (`postgresDb`, Mongo client) are module-level (correct connection reuse).
- MUI v7 RTL setup (`MuiEmotionCacheProvider` + `rtlPlugin` + `enableCssLayer`) is correct;
  `login/page.tsx` Suspense usage and the server-side auth layouts follow App Router conventions.
- `.env*` is gitignored (secrets are not committed — the leak risk is the **test compose file**
  and the **Docker build context**, not the repo's `.env`).

---

## Suggested remediation order

_(Re-ordered for the air-gapped threat model — functional blockers first, security demoted.)_

1. **Functional blockers first:** realtime (WS reconnect → offline replay → optimistic-vs-broadcast
   race → undo-history split) → HiveClient retry cap → reducer mutation → `cEC` filter →
   `createWeek` transaction → event-range bounds → remove the PersonalSettings mock data →
   WS malformed-frame `try/catch`.
2. **Productionize CI/infra:** `test:unit` gating before image publish → DB healthchecks →
   error-status codes (drop HTTP-200-on-error) → standalone image slimming → hermetic e2e →
   `.dockerignore`.
3. **Quality pass:** the perf/memoization work (memoize context values, O(1) Gantt lookups) →
   the SOLID/DRY refactors → the MUI/Tailwind/RTL cleanups.
4. **Security hygiene (optional under air-gap):** the cheap wins from 🔒 Security — gate
   `debug`/delete token logs, add the `NEXTAUTH_SECRET` guard, document the intentional TLS
   setting, add the clearance/attribution check. Defer the actor-dependent items unless the
   deployment stops being air-gapped.
