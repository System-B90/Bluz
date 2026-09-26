# Bluz CLI (`bluz`)

A Python command-line tool for driving the Bluz scheduling & curriculum API from
your terminal. Built with [Typer](https://typer.tiangolo.com/) and
[InquirerPy](https://github.com/kazhala/InquirerPy), it speaks the same `/api/*`
surface the web UI does and ships with every Bluz version.

## Quick Start

```bash
# 1. Install the CLI (from the repo root)
pip install ./cli

# 2. Point it at your Bluz server and store a session token (interactive)
bluz login

# 3. Use it
bluz iterations list
bluz rooms list
bluz gantt curriculums list
bluz --json events list --start 2026-01-01T00:00:00Z --end 2026-01-08T00:00:00Z
bluz calendar export-ics --start 2026-01-01T00:00:00Z --end 2026-02-01T00:00:00Z -o schedule.ics

# 4. Or drive the whole thing from a menu
bluz interactive
```

Run any command with `--help` for its options, e.g. `bluz gantt modules --help`.

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

| Source | URL | Token | Insecure |
| --- | --- | --- | --- |
| CLI flag | `--url` | `--token` | `--insecure` |
| Environment | `BLUZ_URL` | `BLUZ_TOKEN` | `BLUZ_INSECURE` |
| Config file | `url` | `token` | `insecure` |

A local `.env` is loaded automatically, so `BLUZ_*` vars there are honoured.

## Command groups

| Group | What it covers |
| --- | --- |
| `bluz auth` | `login`, `logout`, `config`, `hive-status`, `ws-ticket` |
| `bluz iterations` | list / current / get / register / patch / set-current / delete / sync-hive |
| `bluz rooms` | list / create / update / delete / set-info |
| `bluz courses` | list / create / update / delete |
| `bluz reservations` | list / create / cancel |
| `bluz outsiders` | list / create / update / delete |
| `bluz events` | list / get / create / update / delete / compare |
| `bluz calendar` | `drafts` (shared drafts CRUD), `snapshots` (capture / restore / delete), `export-ics` |
| `bluz settings` | get / set (+ prayerTimes, mealTimes and schedule helpers) |
| `bluz personal` | get / set — per-user filters and Google Calendar toggles |
| `bluz colors` | list / get / create / update / delete — custom event colours |
| `bluz hive` | read-only Hive reference data: users / students / classes / subjects / modules / rooms / lessons / queues / avatar, plus `activate-lessons` |
| `bluz integrations google` | status / connect / disconnect / sync / calendars / select-calendar / purge |
| `bluz student-view` | `schedule` (one day of the student board), `report-engagement` |
| `bluz ai` | `tools` (capabilities + whether AI is configured), `chat` (streaming), `benchmark` |
| `bluz gantt` | `curriculums`, `syllabuses`, `modules`, `events`, `days`, `weeks` (CRUD + link/allocate/reorder), curriculum export/import/constraints/mappings/duplicate/execution, the cut pipeline (`cut-preview`, `cut-plan`, `cut`, `cut-status`, `pull-back`), `execution` / `recreate-occurrence`, shuffle groups and recurrence exceptions |

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
*different* curriculum — pull that one back before cutting this one.

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

The CLI version is single-sourced in `bluz_cli/__init__.py` and tracks the Bluz
release version — `scripts/publish.py` bumps it alongside the `package.json`
manifests so every Bluz version ships a matching CLI.
