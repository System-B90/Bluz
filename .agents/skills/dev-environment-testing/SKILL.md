---
name: dev-environment-testing
description: Guides the agent in running, managing, and debugging the Docker-based Bluz development and E2E testing environments, running E2E suites with Playwright, and ensuring code quality.
version: 1.0.0
tags:
  - docker
  - playwright
  - testing
  - dev-ops
---

# Dev Environment & Testing Skill

This skill provides guidelines and procedures for managing the Bluz Docker composition, executing Playwright E2E tests, and checking code style conventions.

## Development Environment Setup

Bluz utilizes Docker Compose for running backend dependencies (PostgreSQL, MongoDB, session websockets, and Nginx proxy) alongside the Next.js frontend application.

### Start the Development Environment
Run the development environment locally using:
```bash
npm run docker:dev
```
This command starts all background containers (Postgres, MongoDB, WebSocket sessions, proxy) in detached mode and configures Docker Compose to sync/watch frontend changes in the `ui` directory.

### Stop the Development Environment
To gracefully stop the environment, run:
```bash
npm run docker:down
```

### Complete Environment Reset
If databases or containers get into an inconsistent state, wipe out the Docker volumes and restart clean:
```bash
npm run docker:nuke
```

---

## E2E Testing Guidelines

All end-to-end integration tests are built with Playwright and **must run against the dedicated test Docker composition**. This ensures that test executions do not pollute or modify the active development database.

### Running Tests

1. **Start the Test Composition:**
   Spin up the dedicated test containers (e.g. `bluz-test-ui`, `bluz-test-mongodb`, `bluz-test-curriculum-db`):
   ```bash
   npm run docker:test
   ```

2. **Execute the E2E Test Suite:**
   Run Playwright tests in headless mode:
   ```bash
   npm run test:e2e
   ```
   Or run the tests using the interactive Playwright UI:
   ```bash
   npm run test:e2e:ui
   ```

3. **Stop & Clean Up Test Composition:**
   Always tear down the test containers and purge test databases/volumes after run completion:
   ```bash
   npm run docker:test:down
   ```

### Debugging Test Failures
- If tests fail, look at the Playwright reports or HTML reports located in the `playwright-report/` directory.
- Trace files and screenshots are captured on failure and stored in `test-results/`.
- Ensure `bluz.bis` maps to `127.0.0.3` in your hosts file, as E2E tests target this domain.

---

## Linting & Code Quality

Always verify code formatting and type safety prior to committing.

- **Check for Code Issues:**
  ```bash
  npm run lint
  ```
- **Auto-Fix Safe Formatting Issues:**
  ```bash
  npm run lint:fix
  ```
- The project runs code formatting validation on `git commit` via `husky` and `lint-staged`.
