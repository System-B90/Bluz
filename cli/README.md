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
| `bluz auth` | `login`, `logout`, `config` |
| `bluz iterations` | list / current / get / register / patch / set-current / delete |
| `bluz rooms` | list / create / update / delete / set-info |
| `bluz courses` | list / create / update / delete |
| `bluz reservations` | list / create / cancel |
| `bluz outsiders` | list / create / update / delete |
| `bluz events` | list / get / create / update / delete / compare |
| `bluz settings` | get / set (+ prayer-times helpers) |
| `bluz gantt` | `curriculums`, `syllabuses`, `modules`, `events`, `days`, `weeks` (CRUD + link/allocate/reorder) and curriculum export/import/constraints/mappings |

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
