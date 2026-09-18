# Security Policy

## Reporting a Vulnerability

**Do not open a public issue for security problems.**

Report privately via
[GitHub Security Advisories](https://github.com/System-B90/Bluz/security/advisories/new)
("Report a vulnerability"). Include reproduction steps, impact, and the affected
surface (Student boundary, Calendar, Gantt, Auth/SSO, session server, CLI, or infra).

You should receive an acknowledgement within a few days. Please allow time for a
fix before any public disclosure.

## Highest-Priority Surface: The Student Boundary

Students ("חניך") hold real Hive sessions and render Bluz's own UI against Bluz's
own database. They are the only untrusted users of the app, which makes this the
most severe class of bug we can ship. Treat a student reaching staff data as
critical regardless of how small the leaked field looks.

A student may reach exactly three things, and nothing else:

| Surface | Allowed |
| --- | --- |
| Page | `/student-view` |
| Read API | `GET /api/student-view/schedule` — the `StudentEvent` projection, server's current day |
| Write API | `POST /api/student-view/engagement` — a duration; identity and date come from the server |
| WebSocket | `WsScope.Hanich` on the student channel — empty pings only |

In scope, and high priority:

- Any staff field reaching the projection: a Hive id, subject id, instructor or
  lecturer, notes, tags, gantt provenance, `hidden`/`locked`/`personalTalk`.
- A colour returned as an id rather than a resolved hex string, or a course/room
  returned as an id rather than a display name.
- Reading another day (`?date=`) or another iteration (`?it=`) as a student.
- Reaching any other API or page with a Hanich session — a logged-in check is not
  a gate.
- Any event data on the student WebSocket channel, or a student socket registering
  a session.
- Anything on the student page that reveals the rest of the app exists.

The invariants, their enforcement points and the adversarial test suites are
documented in [`docs/student-boundary.md`](../docs/student-boundary.md).

## Scope Notes

- Auth is Hive SSO (OAuth via next-auth) with JWT sessions and AES-GCM token
  encryption — issues in token handling are high priority.
- Secrets live only in `.env`; anything exposed via `NEXT_PUBLIC_*` reaches the
  browser by design. A secret behind that prefix is itself a vulnerability — report it.
- The WebSocket session server broadcasts edits between clients; auth bypasses
  there are in scope.

## TLS Certificate Verification Is Intentionally Disabled

`NODE_TLS_REJECT_UNAUTHORIZED=0` is set by `setup.py` for every deployment
(dev and production) and defaulted in `ui/src/instrumentation.ts` for a
hand-rolled `.env` that omits it. **This is deliberate, not an oversight.**

Bluz ships for airgapped networks by default: Hive and the reverse proxy in
front of it are typically self-signed internally, with no route to a public
CA. In that topology, TLS certificate validation is not the security
boundary — network isolation is. Requiring a real (or internally-issued and
distributed) CA chain for every internal hop would either block install on a
disconnected network or push operators toward `--insecure`/`curl -k`-style
workarounds scattered through the codebase instead of one documented knob.

This is **not** appropriate for an internet-facing deployment. An operator
running Bluz outside an airgapped network, or terminating TLS to services
across a boundary they don't control, should set
`NODE_TLS_REJECT_UNAUTHORIZED=1` (or unset it and supply proper trusted
certificates) — `instrumentation.ts` only fills in `"0"` when the variable is
completely unset, so an explicit value in `.env` is always respected.

Do not report the presence of `NODE_TLS_REJECT_UNAUTHORIZED=0` in the default
config as a vulnerability on its own; a report is in scope only if it shows a
concrete attack achievable *within* the airgapped topology this default
assumes (e.g. a rogue host already inside the network).

## Supported Versions

Only the latest released version (latest `BLUZ_VERSION` tag) receives security fixes.
