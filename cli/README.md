# Bluz (`bluz`)

Script and drive the Bluz scheduling & curriculum server from Python. One
package gives you:

- **A typed Python SDK** — `from bluz import Bluz`. Pydantic models with real
  `date`/`datetime`/`time` fields, navigable like the data itself (iterate a
  curriculum for its syllabuses, look children up by title, call
  `.update()`/`.delete()` on the objects). Ships `py.typed`; passes
  `mypy --strict`.
- **The `bluz` CLI** — every `/api/*` route as a command, built on the same SDK.

It ships with every Bluz version.

## Quick Start

```bash
# 1. Install (from the repo root; [ipython] adds a nicer REPL)
pip install "./cli[ipython]"

# 2. Point it at your Bluz server and store a session token (interactive)
bluz login

# 3. Script it
ipython
```

```python
from bluz import Bluz, EventType, today
from datetime import timedelta

bz = Bluz()  # uses `bluz login` / BLUZ_URL + BLUZ_TOKEN
bz.iterations.current()  # Iteration(id='2026b', ...)

cur = bz.gantt.curriculums["Bis90 2026"]  # by title or id — one request, whole tree
for syllabus in cur:  # Curriculum → Syllabus → Module → GanttEvent
    for module in syllabus:
        print(syllabus.title, module.title, sum(e.minimum_duration for e in module))
cur["Mathematics"]["Algebra"]["Intro"].allocated_duration

week = bz.events.list(today(), today() + timedelta(days=7))
week.where(type=EventType.LECTURE)  # Collection: list + lookup/filter helpers
```

```bash
# 4. Or use the CLI
bluz iterations list
bluz rooms list
bluz gantt curriculums list
bluz --json events list --start 2026-01-01T00:00:00Z --end 2026-01-08T00:00:00Z
bluz calendar export-ics --start 2026-01-01T00:00:00Z --end 2026-02-01T00:00:00Z -o schedule.ics

# 4. Or drive the whole thing from a menu
bluz interactive
```

Run any command with `--help` for its options, e.g. `bluz gantt modules --help`.

## Python SDK

### Finding your way around

Tab completion on `bz.` is the table of contents — every API area is an
attribute:

| `bz.`                                            | What it covers                                                                         |
| ------------------------------------------------ | -------------------------------------------------------------------------------------- |
| `iterations`                                     | course runs: `current()`, `["2026a"]`, `register`, `patch`, `usage`                    |
| `courses`, `rooms`, `outsiders`, `colors`        | directories: `list()`, `get(id)`, `["name"]`, `create`, `update`, `delete`             |
| `reservations`                                   | room bookings: `list(room=, start=, end=)`, `create`, `cancel`                         |
| `events`                                         | calendar: `list(start, end)`, `get(*ids)`, `create`, `update`, `history`, `export_ics` |
| `drafts`, `snapshots`                            | shared drafts; restore points (`snapshot.restore()`)                                   |
| `gantt.curriculums` … `gantt.days`               | the curriculum engine, plus the cut pipeline on `gantt.curriculums`                    |
| `settings`, `personal`                           | app settings (`schedule()`, `meal_times()`), the user's own settings                   |
| `google`, `hive`, `ai`, `student_view`, `system` | integrations, Hive reference data, the assistant, the student board, health            |
| `http`                                           | the raw client — `bz.http.get("/api/...")` for anything without a method               |

In IPython, `bz.gantt.curriculums?` shows a namespace's docstring and
examples, `Curriculum??` shows the source, and models print as one line
(`Curriculum(id='c1', title='Bis90', is_draft=False, children=7)`) rather than
a field dump. `curriculum.tree()` renders the whole tree.

### Conventions

- **Attributes are snake_case** (`event.start_time`); the wire is camelCase.
  Fields the server sends that this version does not know are kept, so
  `model.to_wire()` and every update round-trip losslessly.
- **Dates are typed**: `datetime` (timezone-aware) for instants, `date` for
  calendar days, `time` for `"HH:mm"` settings. Pass `date`/`datetime` or ISO
  strings to any method. `bluz.today()` is today on the Bluz wall clock
  (Asia/Jerusalem).
- **Ids or objects**: every argument that names a thing takes its id or the
  object (`bz.reservations.list(room=bz.rooms["Lab"])`).
- **Lookups**: `api["title or id"]` and `node["child title"]` raise
  `NotFoundError`; `collection.find(...)` returns `None` instead.
- **Iteration scope**: iteration-aware calls default to the current
  iteration. `bz.scoped("2026a")` (or `iteration.scoped()`) is a session that
  reads another iteration by default.
- **Errors**: everything derives from `bluz.BluzError`; server errors are
  `BluzApiError` with `.error_name`, `.error_message`, `.http_status`.
- A response that does not fit its model is kept unvalidated with a
  `ResponseShapeWarning`. Make it fatal in your tests with
  `warnings.simplefilter("error", bluz.errors.ResponseShapeWarning)`.

### Examples

Runnable scripts live inside the package:

```bash
python -m bluz.examples                    # list them
python -m bluz.examples walk_curriculum    # run one against your server
```

| Example           | Shows                                              |
| ----------------- | -------------------------------------------------- |
| `walk_curriculum` | tree navigation, per-syllabus totals               |
| `weekly_load`     | date-range queries, hours per course               |
| `cut_dry_run`     | the plan-then-confirm cut flow, read-only          |
| `safe_bulk_edit`  | snapshot → edit → roll back on failure             |
| `build_syllabus`  | creating syllabuses/modules/events on a draft copy |

## Interactive mode

`bluz interactive` opens a searchable menu over the command tree instead of
asking you to remember flags:

1. Pick a group (`gantt`, `events`, `calendar`, …) or a command.
2. Answer one prompt per **required** argument.
3. Add **optional** values from a list — pick `(run it)` when you are done.

The command then runs and renders exactly as it would on the command line, and
the menu comes back, so a session is a sequence of calls rather than one. A
failed call prints its error and the loop continues.

The menu is generated from the real Click command tree, so every command in
this README — and every one added later — appears in it without a second list
to maintain. It needs a terminal: piped or redirected, it tells you to run the
command directly instead of failing inside a prompt.

## Authentication

Bluz authenticates browser requests with a **next-auth session cookie**. The CLI
reuses that same credential:

1. Sign in to Bluz in your browser.
2. Open dev-tools → Application → Cookies and copy the value of
   `__Secure-next-auth.session-token` (HTTPS) or `next-auth.session-token` (HTTP).
3. Run `bluz login` and paste it when prompted.

Credentials are stored per-user (location shown by `bluz auth config`). On
Linux/macOS the config file is written with `0600` permissions. On Windows,
`chmod(0600)` only toggles the read-only DOS attribute and does not restrict
who can read the file — it relies on your user account's own file
permissions, same as most local config files. For self-signed certificates,
pass `--insecure`.

### Configuration precedence

Each setting resolves in this order (first wins):

| Source      | URL        | Token        | Insecure        |
| ----------- | ---------- | ------------ | --------------- |
| CLI flag    | `--url`    | `--token`    | `--insecure`    |
| Environment | `BLUZ_URL` | `BLUZ_TOKEN` | `BLUZ_INSECURE` |
| Config file | `url`      | `token`      | `insecure`      |

A local `.env` is loaded automatically, so `BLUZ_*` vars there are honoured.

## Command groups

| Group                      | What it covers                                                                                                                                                                                                                                                                                                                     |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bluz auth`                | `login`, `logout`, `config`, `hive-status`, `ws-ticket`                                                                                                                                                                                                                                                                            |
| `bluz iterations`          | list / current / get / register / patch / set-current / delete / sync-hive                                                                                                                                                                                                                                                         |
| `bluz rooms`               | list / create / update / delete / set-info                                                                                                                                                                                                                                                                                         |
| `bluz courses`             | list / create / update / delete                                                                                                                                                                                                                                                                                                    |
| `bluz reservations`        | list / create / cancel                                                                                                                                                                                                                                                                                                             |
| `bluz outsiders`           | list / create / update / delete                                                                                                                                                                                                                                                                                                    |
| `bluz events`              | list / get / create / update / delete / compare                                                                                                                                                                                                                                                                                    |
| `bluz calendar`            | `drafts` (shared drafts CRUD), `snapshots` (capture / restore / delete), `export-ics`                                                                                                                                                                                                                                              |
| `bluz settings`            | get / set (+ prayerTimes, mealTimes and schedule helpers)                                                                                                                                                                                                                                                                          |
| `bluz personal`            | get / set — per-user filters and Google Calendar toggles                                                                                                                                                                                                                                                                           |
| `bluz colors`              | list / get / create / update / delete — custom event colours                                                                                                                                                                                                                                                                       |
| `bluz hive`                | read-only Hive reference data: users / students / classes / subjects / modules / rooms / lessons / queues / avatar, plus `activate-lessons`                                                                                                                                                                                        |
| `bluz integrations google` | status / connect / disconnect / sync / calendars / select-calendar / purge                                                                                                                                                                                                                                                         |
| `bluz student-view`        | `schedule` (one day of the student board), `report-engagement`                                                                                                                                                                                                                                                                     |
| `bluz ai`                  | `tools` (capabilities + whether AI is configured), `chat` (streaming), `benchmark`                                                                                                                                                                                                                                                 |
| `bluz gantt`               | `curriculums`, `syllabuses`, `modules`, `events`, `days`, `weeks` (CRUD + link/allocate/reorder), curriculum export/import/constraints/mappings/duplicate/execution, the cut pipeline (`cut-preview`, `cut-plan`, `cut`, `cut-status`, `pull-back`), `execution` / `recreate-occurrence`, shuffle groups and recurrence exceptions |

### The cut pipeline

`cut` materializes a published, iteration-linked curriculum into real schedule
events. Preview first — it runs the same planner with no gating and no writes:

```bash
bluz gantt curriculums cut-preview <id>
bluz gantt curriculums cut <id>          # --force to re-cut
bluz gantt curriculums cut-status <id>
bluz gantt curriculums pull-back <id>    # soft-delete the generated events
bluz gantt curriculums execution <id>    # תכנון מול ביצוע (plan vs. actual)
```

Gating failures are coded, and nothing is written when they fire: `draft`,
`no-iteration`, `already-cut`, `foreign-cut` (HTTP 409) and `invalid-plan`
(HTTP 400). `foreign-cut` means the linked iteration still holds a live cut of a
_different_ curriculum — pull that one back before cutting this one.

### Parent ids on gantt lists

`bluz gantt <entity> list` returns `{id, title}` rows. Add `--with-parents` to
get each row's parent id too (`syllabusId` on modules, `moduleId` on events,
and so on; `null` when the child has no junction row):

```bash
bluz gantt modules list --with-parents --json
```

### Recurring gantt events

```bash
bluz gantt events except-occurrence <event-id> --curriculum-id <c> --day-id <d>
bluz gantt events materialize <event-id> --curriculum-id <c> --module-id <m> --day-id <d>
bluz gantt events duplicate <event-id> --module-id <m>
bluz gantt curriculums recurrence-exceptions <id>
```

### Iteration scoping

Calendar reads and writes target the current iteration unless you pass
`--iteration/--it` (the server's `it` query param). Writes to a past iteration
are rejected server-side. Supported by `bluz events`, `bluz courses`,
`bluz calendar drafts`, `bluz calendar snapshots` and `bluz calendar export-ics`.
Rooms and outsiders are global (not per-iteration), so they take no flag.

### Google Calendar

`bluz integrations google connect` takes the authorization code produced by the
browser-side Google Identity Services popup — there is no terminal-only OAuth
flow. `status` reports whether the server is configured at all; on deployments
without Google credentials the integration is simply off.

### The AI assistant

```bash
bluz ai tools                      # what it can do; `enabled: false` when no key is configured
bluz ai chat "מה יש ביום ראשון?"    # streams the answer as it is generated
bluz ai benchmark                  # provider self-test (throttled to once an hour)
```

A turn that wants to **write** stops and waits for a human, exactly as in the
browser. Re-run with `--approve <toolCallId> --messages <transcript>` to let one
call through, or pass `--yes` to approve and resume in a single invocation.

Several staff can mirror into one shared calendar: its owner shares it in
Google with "make changes to events", each user runs
`bluz integrations google calendars` and `select-calendar --id <id>` on it, and
every Bluz event is then written there once. `purge --scope orphaned` removes
Bluz-created copies whose event is gone, moved iteration, or left your sync
scope; `purge --scope all` wipes every Bluz-created copy (hand-made Google
events are never touched).

## Global options

- `--json` — emit raw JSON instead of Rich tables (script-friendly).
- `--url`, `--token`, `--insecure/--secure` — override config for one invocation.
- `--version` — print the CLI version.

## Output

By default results render as Rich tables. Add `--json` for machine-readable
output:

```bash
bluz --json iterations list | jq '.[].id'
```

## Versioning

The CLI version is single-sourced in `bluz/__init__.py` and tracks the Bluz
release version — `python -m sb90_deploy publish` bumps it alongside the `package.json`
manifests so every Bluz version ships a matching CLI.
