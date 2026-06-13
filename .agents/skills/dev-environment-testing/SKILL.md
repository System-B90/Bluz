---
name: dev-environment-testing
description: Guides the agent in running, managing, and debugging the Docker-based Bluz development and E2E testing environments, running E2E suites with Playwright, and ensuring code quality.
version: 1.1.0
tags:
  - docker
  - playwright
  - testing
  - dev-ops
  - windows-11
  - pwsh-7
---

# Dev Environment & Testing Skill (Windows 11 & PWSH 7)

This skill provides guidelines and procedures for managing the Bluz Docker composition, executing Playwright E2E tests, and checking code style conventions on **Windows 11** using **PowerShell 7 (PWSH 7)**.

## Environment Constraints

- **OS:** Windows 11
- **Shell:** PowerShell 7 (PWSH 7)
- **Command Chaining:** PWSH 7 natively supports `&&` and `||` operators, as well as statement separators like `;`.
- **Environment Variables:** Set environment variables using `$env:VAR_NAME = "value"` (e.g., `$env:BLUZ_VERSION = "0.2.0"`).

---

## Development Environment Setup

Bluz utilizes Docker Compose for running backend dependencies (PostgreSQL, MongoDB, session websockets, and Nginx proxy) alongside the Next.js frontend application.

### Start the Development Environment
Run the development environment locally in PWSH 7:
```powershell
npm run docker:dev
```
Or run the composition explicitly:
```powershell
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d; docker compose -f docker-compose.yml -f docker-compose.dev.yml watch ui
```

### Stop the Development Environment
To gracefully stop the environment, run:
```powershell
npm run docker:down
```

### Complete Environment Reset
If databases or containers get into an inconsistent state, wipe out the Docker volumes and restart clean:
```powershell
npm run docker:nuke
```

---

## E2E Testing Guidelines

All end-to-end integration tests are built with Playwright and **must run against the dedicated test Docker composition**.

### Running Tests

1. **Start the Test Composition:**
   Spin up the dedicated test containers (e.g. `bluz-test-ui`, `bluz-test-mongodb`, `bluz-test-curriculum-db`):
   ```powershell
   npm run docker:test
   ```

2. **Execute the E2E Test Suite:**
   Run Playwright tests in headless mode inside the PWSH 7 terminal:
   ```powershell
   npm run test:e2e
   ```
   Or run the tests using the interactive Playwright UI:
   ```powershell
   npm run test:e2e:ui
   ```

3. **Stop & Clean Up Test Composition:**
   Always tear down the test containers and purge test databases/volumes after run completion:
   ```powershell
   npm run docker:test:down
   ```

### Debugging Test Failures
- Playwright reports are stored in `playwright-report\`.
- Trace files and screenshots are captured on failure and stored in `test-results\`. Use backslashes (`\`) for Windows 11 file paths in commands.
- Ensure `bluz.bis` maps to `127.0.0.3` in your Windows hosts file (`C:\Windows\System32\drivers\etc\hosts`).
