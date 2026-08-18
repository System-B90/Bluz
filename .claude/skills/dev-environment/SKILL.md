---
name: dev-environment
description: Dev env setup, Docker management, E2E Playwright tests, container log diagnostics.
tags: [docker, dev-env, playwright, diagnostics]
---

## Prerequisites
- `bluz.dev` → `127.0.0.3` in `C:\Windows\System32\drivers\etc\hosts`
- Generate `.env` once: `python setup.py`

## Dev Modes (agent-preferred: `tools.py`)

`tools.py dev` backgrounds the same npm scripts and returns immediately — no blocking
foreground process to manage. **Always check status before starting one:**
```powershell
python tools.py dev status   # port 3000 + https://bluz.dev check; exit code reflects up/down
```
If it reports up, don't start another server — browse to `https://bluz.dev` to test
local changes; it's already wired to the dev server and picks up HMR.

```powershell
python tools.py dev             # host-based: npm run dev in the background (fast HMR)
python tools.py dev --docker    # full stack in containers: npm run docker:dev
python tools.py dev stop        # stops the background process tools.py started
```

**Raw npm equivalents** (blocking foreground — only use directly if you need to watch
live output or `tools.py` isn't available):
```powershell
npm run dev             # copies .env → ui/.env, starts proxy container + Next.js on host
npm run docker:dev      # full stack in containers, needed for Nginx/proxy changes
npm run docker:down     # stop (also: python tools.py docker down)
npm run docker:nuke     # stop + wipe volumes, resets DB (also: python tools.py docker nuke)
```

## Remote DB (mks-srvu)
```powershell
ssh john@mks-srvu "/home/john/Bluz/.venv/bin/python /home/john/Bluz/.agents/remote_check.py"
# Credentials: john / a. Add -i for interactive service selection.
# Checks ports: 5432, 5433, 27017, processes.
```

## E2E Tests
```powershell
npm run docker:test        # start isolated test containers
npm run test:e2e           # headless (also: python tools.py test e2e)
npm run test:e2e:ui        # interactive
npm run docker:test:down   # stop test containers
```

### E2E in a cloud agent session (Linux container)
The commands above assume a Windows workstation with images already built.
A Claude Code cloud session starts with **no docker daemon running, no images,
and no Hive stack**, so E2E needs a setup pass first — read
**[`docs/e2e-cloud-runbook.md`](../../../docs/e2e-cloud-runbook.md)** before
trying. Four things bite immediately and are not guessable:

- `dockerd` is installed but **not running** — start it yourself.
- The agent HTTPS proxy intercepts `hive.org`/`bluz.dev` and returns **403**;
  extend `NO_PROXY`/`no_proxy` with those hostnames.
- Hive source (`hivelms/Hive`) is unreachable — pull prebuilt images from
  `ghcr.io/system-b90/hive/*` instead, using `NPM_TOKEN` for `docker login`.
- The Hive stack directory **must be named `hive`**, or the compose network
  becomes `hive-stack_hive-net` and Bluz cannot attach.

Then run the pipeline the same way CI does — never `npm run test:e2e` directly,
and never `npm run docker:test` (it is Windows-only `set VAR=…&&` syntax):
```bash
python scripts/run_tests.py --seed-hive --skip-unit
```

## Container Log Reference
| Service    | Dev container          | Test container              |
|------------|------------------------|-----------------------------|
| Next.js    | `bluz-ui`              | `bluz-test-ui`              |
| WebSockets | `bluz-sessions`        | `bluz-test-sessions`        |
| Proxy      | `bluz-proxy`/`bluz-proxy-local` | `bluz-test-proxy`  |
| Postgres   | `bluz-curriculum-db`   | `bluz-test-curriculum-db`   |
| MongoDB    | `bluz-mongodb`         | `bluz-test-mongodb`         |

```powershell
docker logs <container> --tail 100
```
