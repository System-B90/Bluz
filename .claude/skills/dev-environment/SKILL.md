---
name: dev-environment
description: Dev env setup, Docker management, E2E Playwright tests, container log diagnostics.
tags: [docker, dev-env, playwright, diagnostics]
---

## Prerequisites
- `bluz.dev` → `127.0.0.3` in `C:\Windows\System32\drivers\etc\hosts`
- Generate `.env` once: `python setup.py`

## Dev Modes

**Host-based (recommended for code changes — fast HMR):**
```powershell
npm run dev   # copies .env → ui/.env, starts proxy container + Next.js on host
```

**Docker-based (needed for Nginx/proxy changes):**
```powershell
npm run docker:dev     # full stack in containers
npm run docker:down    # stop
npm run docker:nuke    # stop + wipe volumes (resets DB)
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
npm run test:e2e           # headless
npm run test:e2e:ui        # interactive
npm run docker:test:down   # stop test containers
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
