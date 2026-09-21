# Student Boundary — Security Priority #1

**This is the highest-priority security property in Bluz.** Everything else in the app is
staff talking to staff. The student ("חניך") boundary is the one place where an
untrusted user renders Bluz's own UI against Bluz's own database, and the only thing
between them and the staff schedule is the code described here.

Assume the student is hostile. They are signed in through Hive, they can read the entire
client bundle, they can see every query parameter the staff calendar uses, and they can
replay any request by hand with any headers they like. Design and review every change on
that assumption.

## Quick Start

```powershell
# The adversarial unit suites (fast, no containers)
npx vitest run --config tests/vitest.config.ts tests/backend/student-data-leak.test.ts
npx vitest run --config tests/vitest.config.ts tests/backend/student-route-surface.test.ts
npx vitest run --config tests/vitest.config.ts tests/backend/student-projection-invariants.test.ts
npx vitest run --config tests/vitest.config.ts tests/backend/student-view-route.test.ts
npx vitest run --config tests/vitest.config.ts tests/backend/student-clearance-gating.test.ts
npx vitest run --config tests/vitest.config.ts tests/backend/student-routing-gate.test.ts
npx vitest run --config tests/vitest.config.ts tests/backend/ws-student-scope.test.ts
npx vitest run --config tests/vitest.config.ts tests/backend/student-day-board.test.tsx

# The same boundary against a real Hive student token (needs the docker stack)
npx playwright test --config tests/playwright.config.ts tests/student-view.spec.ts
```

## What a student is allowed

| Surface | Allowed | Notes |
| --- | --- | --- |
| Pages | `/student-view` only | Every staff page is under `app/(themed)/(post-auth)/`, whose layout silently redirects a non-staff session here. |
| APIs (read) | `GET /api/student-view/schedule` | The only readable endpoint. Returns the `StudentEvent` projection for **the server's current day**. |
| APIs (write) | `POST /api/student-view/engagement` | Duration only. The user id comes from the session and the date from the server clock. |
| WebSocket | `WsScope.Hanich` on `STUDENT_SYNC_ID` | Empty pings only. A student socket may not register a session. |

Everything else must refuse with 401/403. A logged-in check is **not** a gate: Hanich
accounts hold real sessions.

## The invariants

1. **Projection, never a document.** `StudentEvent` is `id`, `name`, `startTime`,
   `endTime`, `color` (resolved hex), `rooms` (display names), `courses` (display names).
   No Hive ids, no subject id, no instructors/lecturers, no notes/tags, no gantt
   provenance, no `hidden`/`locked`/`required`/`personalTalk`.
2. **The colour is a hex string.** A colour *id* is a custom-colour id or a Hive subject
   id; returning one leaks the subject. Resolution happens server-side.
3. **Names, never ids.** A course or room that cannot be resolved to a display name is
   dropped from the projection, never passed through as an id.
4. **The day is the server's.** `?date=` is rejected — not ignored — for a student, so a
   probe is a hard error rather than a silently-successful request. Only staff previewing
   may pass one.
5. **The iteration is the current one.** `?it=` is stripped for a student, so other
   iterations stay invisible; the parameter is honoured only for staff.
6. **Exclusions live in the query.** Hidden events and other days are excluded in the
   Mongo filter itself, so no later refactor of the mapper can reinstate them.
7. **Fake events look real.** "פיקטיבי" events are returned as ordinary events by
   construction — they are meant to be indistinguishable.
8. **The response envelope is closed.** `date`, `events`, `calendarDayStartTime`,
   `calendarDayEndTime`. The grid bounds ride along precisely so the board never needs to
   call the settings API, which a student may not call.
9. **The board mounts no staff providers.** `StudentDayBoard` pulls in no Courses/Hive/
   Settings provider, no dialogs, no app bar — there is no staff surface in the React
   tree to inspect, and nothing on screen implies the rest of the app exists.
10. **The socket carries no data.** Students refetch through the projection endpoint; the
    student channel broadcasts empty pings. Never add a per-iteration student channel.
    This is enforced on the wire, not by call-site discipline: `STUDENT_SYNC_ID` is
    declared in `payloadFreeSyncObjects`, so the session-server core strips `data` from
    anything targeted at it however the broadcast was issued.
11. **A ticket opens one socket.** `singleUseTickets` is on, so a ticket observed inside
    its 30s TTL cannot be replayed into a second socket carrying the holder's scope, and
    the core budgets connects per remote address before it even verifies a ticket.

## Where it is enforced

| Concern | File |
| --- | --- |
| Session gate + projection | `ui/src/api-server/student-view.ts` |
| The one readable route | `ui/src/app/api/student-view/schedule/route.ts` |
| Engagement write | `ui/src/app/api/student-view/engagement/route.ts` |
| Staff page redirect | `ui/src/app/(themed)/(post-auth)/layout.tsx` |
| Student route shell | `ui/src/app/(themed)/(student)/student-view/` |
| Socket scope | `ui/src/app/api/ws-ticket/route.ts`, `session-server.ts` |
| The board itself | `ui/src/components/student-view/` |

## Test map

| Suite | Covers |
| --- | --- |
| `tests/backend/student-route-surface.test.ts` | **Whole-surface sweep.** Every `route.ts` under `app/api` must gate (directly or through a shared builder) or sit on an explicit `PUBLIC_ROUTES` allowlist with a reason; the student surface is pinned to exactly two routes; the schedule route stays read-only and engagement write-only; the student component tree imports no staff module and names no non-student endpoint. |
| `tests/backend/student-projection-invariants.test.ts` | **Gate + builder in isolation.** Every clearance value that may and may not pass, every `?date=` shape a student could send, and the projection against hostile documents (extra fields, nested staff blobs, inherited properties, `__proto__`, wrong types) asserted on own *and* inherited keys. |
| `tests/backend/student-data-leak.test.ts` | **Adversarial.** Date probes (casing, duplication, encoding, traversal, `$ne`), iteration probes, forged clearance headers, projection under fully-populated staff documents, unresolvable ids, Hive down, read-only verbs. |
| `tests/backend/student-view-route.test.ts` | Field whitelist, envelope keys, calendar hours, room short names, hidden-event filter, colour resolution. |
| `tests/backend/student-clearance-gating.test.ts` | Staff routes refusing a Hanich JWT; ws-ticket scope. |
| `tests/backend/student-routing-gate.test.ts` | Staff pages redirecting silently — no 403 page, nothing naming what was refused. |
| `tests/backend/ws-student-scope.test.ts` | The session server's own gate on the signed scope, the wire-level payload strip on the student channel, and the refusal of a replayed ticket. |
| `tests/backend/student-day-board.test.tsx` | The board derives its filters from delivered events only, and issues exactly one request. |
| `tests/student-view.spec.ts` | The whole boundary against a real Hive student token: staff APIs, staff pages, the raw response body, the rendered HTML, the socket frames — plus a sweep that scans **every HTTP body and websocket frame the page receives** for staff markers, and asserts the projection's *values* (hex colours, display names, never a uuid). |

## Rules for changing any of this

- A failing test in these suites is a **data leak**, not a styling regression. Never relax
  an assertion to make one pass.
- Adding a field to `StudentEvent` or to the response envelope is a boundary change:
  update `student-view.ts`, the whitelist assertions in both route suites, and this
  document in the same commit.
- Adding a route under `app/api/` means calling `requireStaffSession()` unless you are
  deliberately extending the student surface — in which case write the adversarial tests
  first.
- Adding a page outside `(post-auth)` means gating it yourself; the group layout is what
  protects everything inside it.
