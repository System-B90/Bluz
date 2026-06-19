# Bluz Integration Tests

End-to-end integration tests for the Bluz scheduling and curriculum management application, built with [Playwright](https://playwright.dev/).

---

## Functionality Map

The table below maps every major Bluz feature to the test file that covers it.

| Feature Area              | Component(s)                                                                                     | Test File          | Key Scenarios                                                                                                                                                                                     |
| ------------------------- | ------------------------------------------------------------------------------------------------ | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Login Page**            | `LoginPage`, `LoginWithHive`                                                                     | `login.spec.ts`    | Page render, SSO button visible, error alerts, unauthenticated redirect                                                                                                                           |
| **Header / AppBar**       | `ScheduleAppBar`, `Filters`, `FilterIcon`, `OfflineModeIcon`, `CurriculumIcon`, `UserAccessCard` | `header.spec.ts`   | AppBar renders, filters toggle, instructor/course filter dropdowns, prayer toggle, PA windows, misconfigs, offline mode, curriculum navigation, settings icon                                     |
| **Calendar (Schedule)**   | `BluzCalendar`, `CalendarView`, `CalendarToolbar`                                                | `calendar.spec.ts` | Page load, view switching (day/work-week/week), date navigation (prev/today/next), toolbar hide/show, fullscreen, date picker                                                                     |
| **Event CRUD**            | `EventDialog`, `EventPrimaryDetails`, `EventClassification`, `EventToggles`, `InstructorsField`  | `calendar.spec.ts` | Create event (click slot → fill dialog → save), edit event (double-click → modify → save), delete event (select + Delete key), dialog field rendering, event type transitions (prayer ↔ standard) |
| **Gantt Page**            | `GanttPage`, `CurriculumFab`, `CurriculumView`, `CurriculumViewTabs`                             | `gantt.spec.ts`    | Page load with placeholder, curriculum drawer open, curriculum selection, loading screen, tab navigation (syllabuses/builder/gantt-view/weeks), URL param sync (`?cid=`, `?v=`)                   |
| **Gantt - Syllabus**      | `SyllabusCard`, `ModulesTable`, `ModuleRow`                                                      | `gantt.spec.ts`    | Syllabus card render, modules table display, module rows                                                                                                                                          |
| **Gantt - Module Dialog** | `ModuleDialog`, `ModuleEventView`                                                                | `gantt.spec.ts`    | Open module dialog, view module events, constraints                                                                                                                                               |
| **Settings - Personal**   | `PersonalSettings`, `SelectionCard`                                                              | `settings.spec.ts` | Open settings, navigate to Personal tab, add/remove groups via autocomplete, add/remove instructors, add/remove favorite outsiders, chip display                                                  |
| **Settings - Global**     | `GlobalSettings`, `PrayerSettings`, `CourseSettings`                                             | `settings.spec.ts` | Global tab render, prayer settings panel (shrink/expand), course settings display                                                                                                                 |
| **Settings - Rooms**      | `RoomSettings`, `RoomListCard`, `RoomFormCard`                                                   | `settings.spec.ts` | Room list display, search/filter rooms, create custom room (fill form → save), edit room, delete room (with confirmation), extended info fields (workstation count, seats, lecture comfortable)   |
| **Settings - Outsiders**  | `OutsiderSettings`                                                                               | `settings.spec.ts` | Outsiders tab render, outsider list display                                                                                                                                                       |
| **Theme Switching**       | `ThemeSelectorIcon`                                                                              | `settings.spec.ts` | Toggle dark/light mode from settings sidebar                                                                                                                                                      |
| **Offline Mode**          | `OfflineProvider`, `PushOfflineUpdatesDialog`                                                    | `header.spec.ts`   | Toggle offline mode, verify offline FAB indicator                                                                                                                                                 |
| **Keyboard Shortcuts**    | Schedule page key handlers                                                                       | `calendar.spec.ts` | Ctrl+Z undo, Ctrl+Y redo, Delete key removes selected event, Escape exits fullscreen                                                                                                              |

---

## Directory Structure

```
tests/
├── README.md              # This file — functionality map and setup guide
├── auth.setup.ts          # Authentication setup via Hive SSO (admin:Password1)
├── calendar.spec.ts       # Calendar schedule + event CRUD tests
├── gantt.spec.ts          # Gantt curriculum page tests
├── header.spec.ts         # Header, navigation, and filter tests
├── login.spec.ts          # Login page tests (unauthenticated)
├── settings.spec.ts       # Settings dialog tests (all tabs)
└── fixtures.ts            # Shared test fixtures and helpers
```

---

## Quick Start

### Prerequisites

- Docker installed
- `bluz.dev` mapped to `127.0.0.3` in your hosts file
- Node.js 22+
- Hive instance running at `https://hive.org` with credentials `admin:Password1`

### Setup

```bash
# Install Playwright browsers (first time only)
npx playwright install chromium

# Start the dedicated test docker composition (isolated from dev)
npm run docker:test

# Seed test data into Hive and Bluz databases
npm run db:seed
```

### Running Tests

```bash
# Run all tests
npm run test:e2e

# Run with Playwright UI (interactive)
npm run test:e2e:ui

# Run a specific test file
npx playwright test tests/calendar.spec.ts

# Run in headed mode (see the browser)
npx playwright test --headed
```

### Teardown

```bash
# Stop and remove test containers + volumes
npm run docker:test:down
```

---

## Test Infrastructure

### Docker Composition

Tests run against a **dedicated test docker composition** (`docker-compose.test.yml`) that is layered on top of the base `docker-compose.yml`. This provides:

- Isolated MongoDB and PostgreSQL containers (test data never pollutes dev databases)
- Test-prefixed container names (e.g., `bluz-test-ui`, `bluz-test-mongodb`)
- Custom Nginx configuration (`nginx.conf.test`) with updated upstreams pointing to test containers
- Test proxy at `127.0.0.3:80/443` (separate from dev)

| Command                    | Description                                       |
| -------------------------- | ------------------------------------------------- |
| `npm run docker:test`      | Start the test composition with test nginx config |
| `npm run docker:test:down` | Stop and remove test containers + volumes         |

**Note:** The test composition automatically mounts `nginx/nginx.conf.test` which routes traffic to the test containers (`bluz-test-ui:3000`, `bluz-test-sessions:28199`) instead of the dev containers.

### Authentication Strategy

The `auth.setup.ts` test project authenticates automatically against the Hive SSO instance:

1. Navigates to `https://bluz.dev/login`
2. Clicks "התחברות עם הייב" to start the OAuth flow
3. Fills `admin` / `Password1` on the Hive login page
4. Handles any OAuth consent screen
5. Waits for the redirect back to the authenticated Bluz app
6. Saves cookies and session to `.auth/user.json`

All other test projects inject this stored state, skipping login entirely.

### CI/CD

Tests run via GitHub Actions on pushes to `master`/`dev` and on pull requests.
See `.github/workflows/e2e.yml`. The CI job:

1. Builds and starts the test docker composition
2. Installs Playwright browsers
3. Runs all tests
4. Uploads `playwright-report/` and `test-results/` as workflow artifacts
5. Tears down test containers

---

## Configuration

| Environment Variable | Default            | Description                                                            |
| -------------------- | ------------------ | ---------------------------------------------------------------------- |
| `BASE_URL`           | `https://bluz.dev` | The Bluz instance URL to test against                                  |
| `CI`                 | _(unset)_          | Set automatically by GitHub Actions; enables retries and stricter mode |
