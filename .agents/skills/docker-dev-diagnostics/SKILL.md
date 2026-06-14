---
name: docker-dev-diagnostics
description: Rules and guidelines for starting the Bluz development environment and troubleshooting Docker container errors on Windows. Prevents running dev scripts directly on the host.
version: 1.0.0
tags:
  - docker
  - troubleshooting
  - dev-env
  - windows-11
---

# Docker Dev Diagnostics & Startup

This skill provides strict rules for launching the local development environment and diagnosing issues.

## CRITICAL: Never Run Dev Locally
**NEVER** run `npm run dev` directly from the Windows host terminal.
The local Windows host cannot properly resolve backend services (like `curriculum-db`, `sessions`, `mongodb`) defined in the Docker network.

Always rely on the Docker composition to run the dev environment.

## Launching the Dev Environment
To launch the dev environment, use the npm script which spins up the containers and watches for changes:
```powershell
npm run docker:dev
```
*Note: This command runs `docker compose up -d` and `docker compose watch ui`. If it is already running, this command is safe to re-run or skip.*

## Analyzing Terminal & Compilation Errors
The Docker Compose files explicitly define container names. Use `docker logs` to retrieve and analyze errors.

### Checking Next.js UI (Compilation & Runtime)
To check for Next.js compilation errors, warnings, or runtime crashes, pull the logs from the UI container:
```powershell
docker logs bluz-ui --tail 100
```
If you need to follow the logs interactively while triggering a bug:
```powershell
docker logs bluz-ui --tail 50 -f
```

### Checking Other Services
If the issue is in the backend or proxy, check the respective container:
- Sessions Server: `docker logs bluz-sessions`
- Proxy / Nginx: `docker logs bluz-proxy`
- Postgres DB: `docker logs bluz-curriculum-db`
- MongoDB: `docker logs bluz-mongodb`

## Windows Host Context
- **OS:** Windows 11 with Docker Desktop (WSL2 Ubuntu integration).
- **Shell:** PowerShell 7 (`pwsh -Command`).
- Be aware of path format differences if passing host paths to containers.
