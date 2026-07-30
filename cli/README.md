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
```

Run any command with `--help` for its options, e.g. `bluz gantt modules --help`.

## Authentication

Bluz authenticates browser requests with a **next-auth session cookie**. The CLI
reuses that same credential:

1. Sign in to Bluz in your browser.
2. Open dev-tools → Application → Cookies and copy the value of
   `__Secure-next-auth.session-token` (HTTPS) or `next-auth.session-token` (HTTP).
3. Run `bluz login` and paste it when prompted.

Credentials are stored per-user (location shown by `bluz auth config`) with
`0600` permissions. For self-signed certificates, pass `--insecure`.

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
| `bluz auth` | `login`, `logout`, `config`, `hive-status` |
| `bluz iterations` | list / current / get / register / patch / set-current / delete / sync-hive |
| `bluz rooms` | list / create / update / delete / set-info |
| `bluz courses` | list / create / update / delete |
| `bluz reservations` | list / create / cancel |
| `bluz outsiders` | list / create / update / delete |
| `bluz events` | list / get / create / update / delete / compare |
| `bluz calendar` | `drafts` (shared drafts CRUD), `snapshots` (capture / restore / delete), `export-ics` |
| `bluz settings` | get / set (+ prayer-times and schedule helpers) |
| `bluz personal` | get / set — per-user filters and Google Calendar toggles |
| `bluz colors` | list / get / create / update / delete — custom event colours |
| `bluz hive` | read-only Hive reference data: users / students / classes / subjects / modules / rooms / lessons |
| `bluz integrations google` | status / connect / disconnect / sync |
| `bluz gantt` | `curriculums`, `syllabuses`, `modules`, `events`, `days`, `weeks` (CRUD + link/allocate/reorder), curriculum export/import/constraints/mappings/duplicate/execution, the cut pipeline (`cut-preview`, `cut`, `cut-status`, `pull-back`) and recurrence exceptions |

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
`no-iteration`, `already-cut` (HTTP 409) and `invalid-plan` (HTTP 400).

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
are rejected server-side. Supported by `bluz events`, `bluz calendar drafts`,
`bluz calendar snapshots` and `bluz calendar export-ics`.

### Google Calendar

`bluz integrations google connect` takes the authorization code produced by the
browser-side Google Identity Services popup — there is no terminal-only OAuth
flow. `status` reports whether the server is configured at all; on deployments
without Google credentials the integration is simply off.

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
