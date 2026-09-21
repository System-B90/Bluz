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
| **Hive lesson / queue**   | `HiveQueueMapping`, `lesson-sync`, `lesson-activation`                                          | `hive-lesson-queue.spec.ts` | Against a real Hive: saving an event creates the lesson + one rule per shuffle, the activator puts the shuffle's students on the chosen queue when the event goes live, clearing the mapping removes the lesson |
| **Dialog keyboard behaviour** | `SettingsDialog`, `EventDialog`                                                              | `dialog-keyboard.spec.ts` | Settings dialog traps focus and restores it to the trigger, settings tabs reachable/activatable by keyboard, event dialog autoFocuses the name field and closes on Escape, event dialog fillable and submittable keyboard-only (#402) |

---

## Directory Structure

```
tests/
├── README.md                        # This file — functionality map and setup guide
├── playwright.config.ts             # Playwright configuration (projects, webServer, reporters)
├── vitest.config.ts                 # Vitest configuration for the backend unit suite
├── auth.setup.ts                    # Authentication setup via Hive SSO (admin:Password1)
├── fixtures.ts                      # Shared test fixtures and helpers
├── ai-assistant.spec.ts             # AI assistant UI tests
├── calendar.spec.ts                 # Calendar schedule + event CRUD tests
├── command-palette.spec.ts          # Command palette tests
├── course-builder.spec.ts           # Course Builder settings tab tests
├── course-collapse.spec.ts          # Course roll-up on schedule events
├── custom-colors.spec.ts            # Custom colors settings tests
├── dialog-keyboard.spec.ts          # Dialog keyboard behaviour (#402)
├── event-dialog-scroll.spec.ts      # Event dialog scrolling (#463)
├── gantt-api-contract.spec.ts       # Gantt collection API parent-id contract tests
├── gantt-recurrence-window.spec.ts  # Gantt recurrence window / skipped occurrences (#468, #469)
├── gantt-recurrence.spec.ts         # Gantt recurring events (#111)
├── gantt-reload.spec.ts             # Gantt → schedule reload
├── gantt.spec.ts                    # Gantt curriculum page tests
├── google-calendar.spec.ts          # Google Calendar: connect, shared calendar for 2 users, orphan/all purge (via google-stub)
├── header.spec.ts                   # Header, navigation, and filter tests
├── hive-lesson-queue.spec.ts        # Hive lesson + queue integration (against a real Hive)
├── instructor-dnd.spec.ts           # Instructor rail drag-and-drop tests
├── login.spec.ts                    # Login page tests (unauthenticated)
├── malformed-body.spec.ts           # Malformed request body handling (#465)
├── offline-mode.spec.ts             # Offline mode tests
├── outsiders.spec.ts                # Outsiders settings tests
├── reservations.spec.ts             # Room reservations tests
├── settings.spec.ts                 # Settings dialog tests (all tabs)
├── split-across-breaks.spec.ts      # Events split across break windows
└── backend/                         # Vitest unit tests (~110 *.test.ts/.tsx) run via `npm run test:unit`
```

---

## Quick Start

### Prerequisites

- Docker installed
- `bluz.dev` mapped to `127.0.0.3` in your hosts file
- Node.js 22+
- Hive instance running at `https://hive.test` with credentials `admin:Password1`

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

**Note:** The test composition automatically mounts `nginx/nginx.conf.test` which routes traffic to this composition's own containers by proxying to the compose *service* names — `ui:3000` (frontend + HMR) and `sessions:28199` (websockets) — resolved via Docker's embedded DNS. Container names are `${TEST_PROJECT_NAME}-*`, so nginx never references them directly.

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
See `.github/workflows/e2e.yml`. The CI job is fully hermetic — it stands up its
own Hive instance instead of depending on an external one:

1. Checks out `hivelms/Hive` (SSO branch; requires the `HIVE_REPO_TOKEN` secret),
   then builds, initializes, and starts it via `manage_hive.py` at `https://hive.test`
2. Verifies the `admin:Password1` account with `pyhive` (pip: `pyhivelms`)
3. Generates a CI `.env` + self-signed SSL certs, installs npm/Python deps and
   Playwright browsers, and pre-builds the test docker images
4. Runs the full pipeline (`python scripts/run_tests.py --seed-hive`): unit tests,
   test composition with dynamic ports, per-run SSO client registration, Drizzle
   schema push, Hive + Bluz seeding via `pyhive`, then Playwright e2e
5. Uploads `playwright-report/`, `test-results/`, and (on failure) container logs
   as workflow artifacts

---

## Configuration

| Environment Variable | Default            | Description                                                            |
| -------------------- | ------------------ | ---------------------------------------------------------------------- |
| `BASE_URL`           | `https://bluz.dev` | The Bluz instance URL to test against                                  |
| `CI`                 | _(unset)_          | Set automatically by GitHub Actions; enables retries and stricter mode |
