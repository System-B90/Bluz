import * as path from "path";

import { test as baseTest, expect as baseExpect, APIRequestContext, Browser, Locator, Page, BrowserContext } from "@playwright/test";

// Shared page and context for visual mode (single-window reuse)
let sharedContext: BrowserContext | null = null;
let sharedPage: Page | null = null;

/**
 * Visual mode reuses ONE context and page for the entire run, across every
 * spec — so cookies, localStorage and any dialog left open carry from one test
 * into the next. That is what you want when watching a run in a real window,
 * and it silently removes every browser-level isolation guarantee the suite
 * otherwise has.
 *
 * Ignoring it under CI means someone exporting TEST_VISUAL to debug cannot
 * accidentally leave the whole pipeline running without isolation, which would
 * show up as inexplicable order-dependent failures rather than as an obvious
 * misconfiguration.
 */
const isVisualMode = process.env.TEST_VISUAL === "1" && !process.env.CI;

export const test = baseTest.extend<{ serverStateIsolation: undefined }>({
    context: async ({ browser, contextOptions }, use) => {
        if (isVisualMode) {
            if (!sharedContext) {
                sharedContext = await browser.newContext(contextOptions);
            }
            await use(sharedContext);
        } else {
            const context = await browser.newContext(contextOptions);
            await use(context);
            await context.close();
        }
    },
    page: async ({ context }, use) => {
        if (isVisualMode) {
            if (!sharedPage) {
                sharedPage = await context.newPage();
            }
            await use(sharedPage);
        } else {
            const page = await context.newPage();
            await use(page);
            await page.close();
        }
    },

    /**
     * Undoes a test's writes to the shared server.
     *
     * Every test already gets a fresh browser context, so nothing leaks
     * through the DOM or localStorage. What does leak is the database: one
     * Hive+Bluz stack is shared by the whole suite, and events a test creates
     * outlive it. They accumulate all run long, and the damage is not
     * hypothetical -- three instructor-dnd specs went from green to red purely
     * because two *other* specs stopped running, changing how crowded the day
     * view was underneath a geometry-based drag. Coupling like that makes the
     * failure list unstable, and an unstable failure list cannot tell a
     * regression from noise.
     *
     * Auto-applied, so specs get isolation without opting in. It only removes
     * what appeared while the test ran: the pre-test snapshot means seeded
     * demo data and anything an earlier test legitimately left is untouched.
     *
     * Best-effort by design. A cleanup failure is logged and swallowed rather
     * than allowed to fail an otherwise-passing test -- an isolation layer
     * that turns green runs red is worse than the coupling it replaces.
     */
    serverStateIsolation: [
        async ({ request }, use) => {
            const originalIteration = await currentIterationId(request).catch(
                () => undefined,
            );
            const eventsBefore = new Set(
                (await listEvents(request).catch(() => [])).map((e) => e.id),
            );
            const curriculumsBefore = new Set(
                await listCurriculumIds(request).catch(() => []),
            );
            const iterationsBefore = new Set(
                await listIterationIds(request).catch(() => []),
            );
            const personalSettingsBefore = await getPersonalSettings(
                request,
            ).catch(() => undefined);
            const collectionsBefore = new Map<string, Set<string>>();
            for (const collection of SWEPT_COLLECTIONS) {
                collectionsBefore.set(
                    collection,
                    new Set(
                        await listCollectionIds(request, collection).catch(
                            () => [],
                        ),
                    ),
                );
            }

            await use(undefined);

            try {
                // Order matters: see restoreIteration.
                await restoreIteration(request, originalIteration);
                await restorePersonalSettings(request, personalSettingsBefore);

                // After the restore above, so a temp iteration is no longer
                // current -- the API refuses to delete the active one.
                for (const id of await listIterationIds(request)) {
                    if (iterationsBefore.has(id)) continue;
                    await request
                        .delete(`/api/iterations/${id}`)
                        .catch(() => {});
                }

                for (const id of await listCurriculumIds(request)) {
                    if (curriculumsBefore.has(id)) continue;
                    // Deleting the curriculum takes its syllabuses, modules
                    // and gantt events with it.
                    await request
                        .delete(`/api/gantt/curriculums/${id}`)
                        .catch(() => {});
                }

                for (const event of await listEvents(request)) {
                    if (eventsBefore.has(event.id)) continue;
                    await request
                        .delete("/api/event", { data: event.id })
                        .catch(() => {});
                }

                for (const collection of SWEPT_COLLECTIONS) {
                    const before = collectionsBefore.get(collection);
                    if (!before) continue;
                    for (const id of await listCollectionIds(
                        request,
                        collection,
                    )) {
                        if (before.has(id)) continue;
                        await request
                            .delete(`/api/${collection}`, { data: id })
                            .catch(() => {});
                    }
                }
            } catch (error) {
                console.warn("[isolation] cleanup failed:", error);
            }
        },
        { auto: true },
    ],
});

export const expect = baseExpect;

/**
 * Saved storage states, one per test user, written by auth.setup.ts.
 *
 * Defined here rather than in auth.setup.ts because auth.setup.ts already
 * imports from this module; putting them the other way round would make the
 * two files import each other.
 */
export const AUTH_FILES = {
    primary: path.join(__dirname, ".auth", "user.json"),
    secondary: path.join(__dirname, ".auth", "user-secondary.json"),
} as const;

/** Storage state for the second seeded account (`michaelks`, ADMIN clearance). */
export const SECONDARY_USER_STATE = AUTH_FILES.secondary;

/**
 * Opens a second, independently authenticated browser session.
 *
 * Needed wherever a test has to watch one user's change land on *another*
 * user's screen (#582). A single session cannot distinguish a working
 * broadcast from a dead one: the writer's own view updates from its local
 * mutation regardless, which is how #587 hid a completely dead
 * server->client channel behind a green suite for weeks.
 *
 * Caller owns the returned context and must close it.
 */
export async function openSecondUserSession(browser: Browser): Promise<{
    context: BrowserContext;
    page: Page;
}> {
    const context = await browser.newContext({
        storageState: SECONDARY_USER_STATE,
    });
    const page = await context.newPage();
    return { context, page };
}

/**
 * Shared test fixtures and helper utilities for Bluz integration tests.
 */

// ─── Selectors ──────────────────────────────────────────────────────────────────

/** MUI Dialog selectors */
export const SELECTORS = {
    /** Settings dialog (the MUI Dialog with max-width lg and settings tabs) */
    settingsDialog: "[role='dialog']",
    /** Event dialog */
    eventDialog: "[role='dialog']",
    /** AppBar */
    appBar: "header.MuiAppBar-root",
    /** MUI Toolbar */
    toolbar: ".MuiToolbar-root",
    /** Calendar container (react-big-calendar root) */
    calendarRoot: ".rbc-calendar",
    /** Calendar toolbar buttons group */
    calendarToolbar: ".rbc-toolbar",
    /** Calendar time slots */
    calendarTimeSlot: ".rbc-time-slot",
    /** Calendar event elements */
    calendarEvent: ".rbc-event",
    /** Calendar day slot */
    calendarDaySlot: ".rbc-day-slot",
    /** MUI Autocomplete */
    autocomplete: ".MuiAutocomplete-root",
    /** Header filter controls (Select-based, not Autocomplete) */
    headerFilterControl: ".MuiFormControl-root",
    /** MUI Chip */
    chip: ".MuiChip-root",
    /** MUI TextField input */
    textFieldInput: ".MuiInputBase-input",
    /** MUI Switch */
    switch: ".MuiSwitch-root",
    /** MUI FormControlLabel */
    formControlLabel: ".MuiFormControlLabel-root",
    /** MUI Button */
    button: ".MuiButton-root",
    /** Snackbar notification */
    snackbar: ".notistack-SnackbarContainer",
} as const;

// ─── Helpers ────────────────────────────────────────────────────────────────────

/** Clicks the center of an icon button (more reliable than default click with MUI tooltips). */
export async function clickIconButton(button: Locator): Promise<void> {
    await button.scrollIntoViewIfNeeded();
    const box = await button.boundingBox();
    if (!box) {
        throw new Error("Icon button has no bounding box");
    }

    await button
        .page()
        .mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}

/**
 * Opens the settings dialog by clicking the gear icon in the AppBar.
 */
export async function openSettingsDialog(page: Page): Promise<void> {
    // The settings icon is an IconButton in the AppBar with class hover-rotate-subtle
    const settingsButton = page.locator(`${SELECTORS.appBar} button.hover-rotate-subtle`);
    const dialog = page.getByRole("dialog").filter({ hasText: "הגדרות" });

    // Single deterministic click: waitForAppLoad has already gated on the
    // hydration marker, so the handler is attached by the time we get here.
    // The old retry loop existed only because that gate did not.
    await waitForHydration(page);
    await settingsButton.click();
    await expect(dialog).toBeVisible({ timeout: 15_000 });
}

/**
 * Closes the settings dialog by clicking its close button.
 */
export async function closeSettingsDialog(page: Page): Promise<void> {
    const dialog = page.locator(SELECTORS.settingsDialog).first();
    const closeButton = dialog.locator("button.hover-rotate-90");
    await closeButton.click();
    await page.waitForSelector(SELECTORS.settingsDialog, { state: "hidden" });
}

/**
 * Navigates to a specific settings tab by clicking its label in the sidebar.
 */
export async function navigateToSettingsTab(
    page: Page,
    tabLabel: string,
): Promise<void> {
    const dialog = page.locator(SELECTORS.settingsDialog).first();
    // Sidebar label appears before panel content with the same text
    await dialog.getByText(tabLabel, { exact: true }).first().click();
    // Allow animation to complete
    await page.waitForTimeout(350);
}

/**
 * Waits for the page to be fully loaded after navigation.
 * Checks that the AppBar is visible as a signal the authenticated app loaded.
 */
export async function gotoAppHome(page: Page): Promise<void> {
    await page.goto("/", { waitUntil: "commit", timeout: 60_000 });
    await waitForAppLoad(page);
}

export async function waitForAppLoad(page: Page): Promise<void> {
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator(SELECTORS.appBar)).toBeVisible({
        timeout: 60_000,
    });
    // The AppBar is server-rendered, so its visibility says nothing about
    // whether React has hydrated — clicks before hydration are silently
    // dropped. `load` only covers the bundle arriving, not React attaching,
    // which is why helpers used to retry clicks. The themed layout sets
    // data-hydrated in an effect, so this waits on the real signal.
    await page.waitForLoadState("load");
    await waitForHydration(page);
}

/**
 * Gates on the hydration marker the themed layout sets in an effect.
 *
 * Missing marker (an image built before it landed) is not fatal — the wait is
 * simply skipped. `networkidle` is deliberately *not* the fallback: the app
 * holds a WebSocket open, so it never goes idle and the wait would burn the
 * whole per-test budget.
 */
export async function waitForHydration(page: Page): Promise<void> {
    await page
        .waitForSelector("body[data-hydrated='true']", { timeout: 5_000 })
        .catch(() => undefined);
}

/**
 * Switches the calendar to day view.
 */
export async function switchToDayView(page: Page): Promise<void> {
    await page.getByRole("button", { name: "יום", exact: true }).click();
    await page.waitForTimeout(300);
}

/**
 * Re-enables pointer events on calendar event chips. The drag-select helpers
 * disable them on `.rbc-events-container` so a drag can pass through overlapping
 * events, but that inline style persists — leaving events unclickable (a later
 * `dblclick` would hit-test through to the grid slot and open a blank new event
 * instead of editing the existing one). Callers that need to interact with an
 * event afterwards must restore pointer events first.
 */
async function restoreEventPointerEvents(page: Page): Promise<void> {
    await page.evaluate(() => {
        document.querySelectorAll(".rbc-events-container").forEach((el) => {
            (el as HTMLElement).style.pointerEvents = "";
        });
    });
}

/**
 * Drag-selects a time range on the calendar to open the event dialog.
 * Single clicks are ignored by the app (see handleSlotSelect); only drag opens the dialog.
 */
export async function selectCalendarTimeRange(page: Page): Promise<void> {
    await switchToDayView(page);

    // Demo events overlay the grid and block pointer events during drag selection
    await page.evaluate(() => {
        document.querySelectorAll(".rbc-events-container").forEach((el) => {
            (el as HTMLElement).style.pointerEvents = "none";
        });
    });

    const daySlot = page.locator(".rbc-time-content .rbc-day-slot").first();
    await daySlot.scrollIntoViewIfNeeded();

    const box = await daySlot.boundingBox();
    if (!box) {
        throw new Error("Calendar day slot not found");
    }

    const x = box.x + box.width / 2;
    const startY = box.y + box.height * 0.25;
    const endY = box.y + box.height * 0.32;

    await page.mouse.move(x, startY);
    await page.mouse.down();
    await page.mouse.move(x, endY, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(500);

    // Restore interactivity so events created/edited afterwards are clickable.
    await restoreEventPointerEvents(page);
}

/**
 * Returns the visible event dialog, if any.
 */
export function getEventDialog(page: Page) {
    return page.getByRole("dialog").filter({ hasText: "עריכת מופע" });
}

/**
 * Calendar filter strip in the AppBar (prayer/PA/misconfig icons live here).
 */
export function getHeaderFilters(page: Page) {
    return page.getByRole("button", { name: /גילוי חלונות פ\"א|הסתרת חלונות פ\"א/ });
}

/** The header filter Popover paper (rendered in a body-level portal). */
export function getFilterPanel(page: Page) {
    return page.locator(".MuiPopover-paper");
}

/**
 * Opens the header filter Popover and waits for it to settle.
 *
 * The Popover keeps itself open while its inner filter IconButtons are clicked
 * (ClickAwayListener only fires on clicks *outside* the paper), so callers open
 * it once and interact freely — no per-click re-open needed. Idempotent: returns
 * immediately if the panel is already visible.
 */
export async function openFilterPanel(page: Page): Promise<void> {
    const panel = getFilterPanel(page);
    if (await panel.isVisible().catch(() => false)) return;
    // Closed-state tooltip label is "הצגת סננים"; open-state is "הסתרת סננים".
    await page.getByRole("button", { name: /הצגת סננים|הסתרת סננים/ }).click();
    await expect(panel).toBeVisible({ timeout: 10_000 });
}

/**
 * Generates a unique test identifier to avoid collisions between test runs.
 */
export function testId(prefix: string = "test"): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).slice(2, 6);
    return `${prefix}-${timestamp}-${random}`;
}

// ─── Offline Mode Helpers ────────────────────────────────────────────────────

/** The push-updates dialog that appears when exiting offline mode with pending changes. */
export function getPushUpdatesDialog(page: Page) {
    return page.getByRole("dialog").filter({ hasText: "שמירת שינויים לוקליים" });
}

/** Clicks the offline toggle. In online mode → enters offline; in offline mode → exits. */
export async function clickOfflineToggle(page: Page): Promise<void> {
    // The toolbar wifi button has either tooltip: "עבור למצב לוקלי" or "חזור למצב מקוון"
    const btn = page.getByRole("button", { name: /מצב לוקלי|מצב מקוון/ });
    await btn.click();
}

/** Enters offline mode (asserts we start in online mode). */
export async function enterOfflineMode(page: Page): Promise<void> {
    await expect(
        page.getByRole("button", { name: /עבור למצב לוקלי/ }),
    ).toBeVisible({ timeout: 5_000 });
    await clickOfflineToggle(page);
    await expect(
        page.getByRole("button", { name: /חזור למצב מקוון/ }),
    ).toBeVisible({ timeout: 5_000 });
}

/**
 * Exits offline mode and returns the push-updates dialog.
 * If no changes were made the dialog won't appear (auto-closes); the
 * returned locator will simply not be visible.
 */
export async function exitOfflineMode(page: Page): Promise<ReturnType<typeof getPushUpdatesDialog>> {
    await clickOfflineToggle(page);
    return getPushUpdatesDialog(page);
}

/**
 * Ensures the test ends in online mode by force-reverting any pending
 * offline changes. Safe to call even when already online.
 *
 * Also dismisses any lingering dialogs (event editor, push-updates) left
 * open by a failed test so they don't block the next retry's pointer events.
 */
export async function cleanupOfflineMode(page: Page): Promise<void> {
    // Close any leftover push-updates dialog from a failed test.
    const staleDialog = getPushUpdatesDialog(page);
    if (await staleDialog.isVisible({ timeout: 1_000 }).catch(() => false)) {
        const revertBtn = staleDialog.getByRole("button", { name: "שחזר הכל" });
        if (await revertBtn.isVisible()) await revertBtn.click();
        else await page.keyboard.press("Escape");
        await page.waitForTimeout(300);
    }

    // Close any other lingering MUI dialog (e.g. event editor left open).
    const anyDialog = page.locator(".MuiDialog-root:visible").first();
    if (await anyDialog.isVisible({ timeout: 500 }).catch(() => false)) {
        await page.keyboard.press("Escape");
        await page.waitForTimeout(300);
    }

    const returnBtn = page.getByRole("button", { name: /חזור למצב מקוון/ });
    if (!(await returnBtn.isVisible())) return;

    await returnBtn.click();
    const dialog = getPushUpdatesDialog(page);
    if (await dialog.isVisible({ timeout: 2_000 }).catch(() => false)) {
        const revertBtn = dialog.getByRole("button", { name: "שחזר הכל" });
        if (await revertBtn.isVisible()) {
            await revertBtn.click();
        }
    }
    await expect(
        page.getByRole("button", { name: /עבור למצב לוקלי/ }),
    ).toBeVisible({ timeout: 10_000 });
}

/**
 * Double-clicks a calendar event by name.
 * Uses `force: true` to bypass `.rbc-time-slot` z-index interception.
 */
export async function dblclickCalendarEvent(page: Page, name: string): Promise<void> {
    // Defensive: a prior drag-select may have left events non-interactive, which
    // would route the dblclick through to the grid and open a blank new event.
    await restoreEventPointerEvents(page);
    const calEvent = page.locator(SELECTORS.calendarEvent).filter({ hasText: name });
    await expect(calEvent.first()).toBeVisible({ timeout: 5_000 });
    await calEvent.first().dblclick({ force: true });
    await page.waitForTimeout(400);
}

/**
 * Creates a calendar event while already in offline mode.
 * Returns the event name used.
 */
export async function createEventInOfflineMode(
    page: Page,
    name: string,
): Promise<void> {
    await switchToDayView(page);

    await page.evaluate(() => {
        document.querySelectorAll(".rbc-events-container").forEach((el) => {
            (el as HTMLElement).style.pointerEvents = "none";
        });
    });

    const daySlot = page.locator(".rbc-time-content .rbc-day-slot").first();
    await daySlot.scrollIntoViewIfNeeded();

    const box = await daySlot.boundingBox();
    if (!box) throw new Error("Calendar day slot not found");

    const x = box.x + box.width / 2;
    const startY = box.y + box.height * 0.25;
    const endY = box.y + box.height * 0.55;

    await page.mouse.move(x, startY);
    await page.mouse.down();
    await page.mouse.move(x, endY, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(500);

    const dialog = getEventDialog(page);
    await expect(dialog).toBeVisible({ timeout: 5_000 });
    await dialog.locator("input").first().fill(name);
    await dialog.getByRole("button", { name: "שמירה" }).click();
    await expect(dialog).not.toBeVisible({ timeout: 5_000 });

    // Restore interactivity so events created/edited afterwards are clickable.
    await restoreEventPointerEvents(page);

    // Ensure the newly-created event is actually rendered before returning,
    // so callers relying on it being present/tracked don't race the save.
    await expect(
        page.locator(SELECTORS.calendarEvent).filter({ hasText: name }),
    ).toBeVisible({ timeout: 5_000 });
}


/* ------------------------------------------------------------------ */
/* Server-side test isolation                                          */
/* ------------------------------------------------------------------ */

/**
 * How far either side of today the cleanup sweep looks for events a test
 * created. Wide enough to catch a gantt cut, which writes across the whole
 * curriculum, and bounded so the query stays cheap.
 */
const CLEANUP_WINDOW_DAYS_BACK = 60;
const CLEANUP_WINDOW_DAYS_FORWARD = 400;

type ApiEvent = { id: string; name?: string };

function cleanupWindow(): { sd: string; ed: string } {
    const sd = new Date();
    sd.setDate(sd.getDate() - CLEANUP_WINDOW_DAYS_BACK);
    sd.setHours(0, 0, 0, 0);
    const ed = new Date();
    ed.setDate(ed.getDate() + CLEANUP_WINDOW_DAYS_FORWARD);
    ed.setHours(23, 59, 59, 999);
    return { sd: sd.toISOString(), ed: ed.toISOString() };
}

async function listEvents(request: APIRequestContext): Promise<Array<ApiEvent>> {
    const { sd, ed } = cleanupWindow();
    const response = await request.get(`/api/event?sd=${sd}&ed=${ed}`);
    if (!response.ok()) return [];
    const body = (await response.json()) as { data?: Array<ApiEvent> };
    return body.data ?? [];
}

/**
 * Gantt curriculums, which leak worse than events do.
 *
 * gantt.spec.ts and gantt-recurrence.spec.ts build a fresh curriculum (plus
 * its syllabuses, modules and events) in `beforeEach` and delete none of it,
 * so every run leaves another pile behind on the shared stack, permanently.
 * course-builder.spec.ts already documents the consequence in a comment:
 * "The shared test env accumulates a long tail of leftover course
 * fixtures ... which makes the hierarchy tree and course-picker Autocomplete
 * considerably slower to interact with" -- i.e. debris from other specs is
 * already slowing later ones toward their timeouts.
 */
/**
 * Entity collections that follow the same REST shape: `GET /api/<x>` returns
 * `{ data: [{ id }] }`, `DELETE /api/<x>` takes the bare id as its JSON body.
 *
 * These are the entities specs create through the settings dialogs. Their
 * per-spec cleanup is written as the last statement of a straight-line flow
 * rather than in a `finally`, so any earlier assertion failure leaks the
 * entity permanently -- and outsiders/custom-colors then assert that no *other*
 * row exists, so one leak makes the next run fail before it can clean up its
 * own entity, which leaks again. Sweeping centrally breaks that cascade
 * regardless of where a spec gave up.
 */
const SWEPT_COLLECTIONS = [ "outsiders", "custom-colors", "course", "rooms" ] as const;

async function listCollectionIds(
    request: APIRequestContext,
    collection: string,
): Promise<Array<string>> {
    const response = await request.get(`/api/${collection}`);
    if (!response.ok()) return [];
    const body = (await response.json()) as { data?: Array<{ id?: string }> };
    return (body.data ?? []).flatMap((row) => (row.id ? [ row.id ] : []));
}

async function listCurriculumIds(
    request: APIRequestContext,
): Promise<Array<string>> {
    const response = await request.get("/api/gantt/curriculums");
    if (!response.ok()) return [];
    const body = (await response.json()) as {
        data?: Array<{ id?: string }>;
    };
    return (body.data ?? []).flatMap((c) => (c.id ? [ c.id ] : []));
}

/**
 * Iterations are the heaviest thing a test can leave behind: each one is its
 * own database. settings.spec.ts and iteration-switch.spec.ts both create a
 * temporary one and delete it in a `finally`, which covers assertion failures
 * but not a crash or a hard timeout -- and a long list of leftovers is itself
 * a failure cause, since both specs locate their row by scanning the list.
 */
/**
 * Personal settings are global per user and are read by other specs -- the
 * header and calendar filter by "my groups" and "my instructors" -- so a spec
 * that adds a group and fails before removing it changes what later specs see.
 * settings.spec.ts adds/removes groups, instructors and the theme as the last
 * statement of a straight-line flow, so any earlier failure leaks them.
 *
 * These are settings rather than entities, so the id-diffing sweep cannot
 * catch them; POST replaces the whole document, which makes an exact
 * snapshot/restore possible instead.
 */
async function getPersonalSettings(
    request: APIRequestContext,
): Promise<unknown | undefined> {
    const response = await request.get("/api/personal-settings");
    if (!response.ok()) return undefined;
    const body = (await response.json()) as { data?: unknown };
    return body.data;
}

async function restorePersonalSettings(
    request: APIRequestContext,
    original: unknown | undefined,
): Promise<void> {
    if (original === undefined || original === null) return;
    const current = await getPersonalSettings(request);
    if (JSON.stringify(current) === JSON.stringify(original)) return;
    await request.post("/api/personal-settings", { data: original });
}

async function listIterationIds(
    request: APIRequestContext,
): Promise<Array<string>> {
    const response = await request.get("/api/iterations");
    if (!response.ok()) return [];
    const body = (await response.json()) as { data?: Array<{ id?: string }> };
    return (body.data ?? []).flatMap((i) => (i.id ? [ i.id ] : []));
}

async function currentIterationId(
    request: APIRequestContext,
): Promise<string | undefined> {
    const response = await request.get("/api/iterations/current");
    if (!response.ok()) return undefined;
    const body = (await response.json()) as { data?: { id?: string } | null };
    return body.data?.id;
}

/**
 * Puts the active iteration back if the test moved it.
 *
 * This runs *before* the event sweep and not after, because every event query
 * resolves against whichever iteration is active: sweeping first would compare
 * one iteration's events against another's and delete the difference.
 */
async function restoreIteration(
    request: APIRequestContext,
    originalId: string | undefined,
): Promise<void> {
    if (!originalId) return;
    if ((await currentIterationId(request)) === originalId) return;
    await request.patch(`/api/iterations/${originalId}`, {
        data: { isCurrent: true },
    });
}

/* ------------------------------------------------------------------ */
/* Gantt module/event dialog helpers                                   */
/* ------------------------------------------------------------------ */

/**
 * The first *visible* "edit event" trigger.
 *
 * `.first()` on its own picks whatever comes first in the DOM, hidden or not,
 * and the curriculum view leaves every visited tab mounted behind
 * `display: none` (see `curriculum-view/tabs/index.tsx`). Filtering first is
 * what makes "first" mean "the one on screen" (#495).
 */
/**
 * The visible "edit event" trigger for `eventTitle`, falling back to the first
 * visible one.
 *
 * `.first()` on its own picks whatever is earliest in the DOM, which is the
 * seeded breaks module ("הפסקות") -- every other place in the suite excludes
 * it by name, and this helper was the one that did not, which is how asking
 * for "הרצאת מבוא" opened `עריכת מופע: ארוחת בוקר הפסקות / הפסקות` (#495).
 *
 * The fallback is deliberate. Filtering strictly made things *worse*: when the
 * title match came up empty the caller saw zero triggers, concluded the module
 * dialog was shut, and went off to reopen it -- hanging on the syllabuses tab
 * until the test timed out, which took both gantt spec files down at once
 * (run 33816271983). Preferring the named trigger and degrading to the old
 * behaviour keeps the improvement without letting a locator miss turn into a
 * worse failure than the one it replaced.
 */
export async function resolveEditEventTrigger(
    page: Page,
    eventTitle?: string,
): Promise<Locator> {
    const triggers = page.getByTitle("עריכת המופע").filter({ visible: true });
    if (eventTitle) {
        const named = triggers.filter({ hasText: eventTitle });
        if ((await named.count()) > 0) return named.first();
    }
    return triggers.first();
}

/** Synchronous form, for callers that only need "is anything visible". */
export function visibleEditEventTrigger(page: Page): Locator {
    return page.getByTitle("עריכת המופע").filter({ visible: true }).first();
}

/**
 * The module dialog hosts the "עריכת המופע" triggers, and it goes away when the
 * curriculum view switches tabs (e.g. to "רצף זמן" and back), so a test that
 * opened it earlier cannot assume it is still usable (#585, #589). Reopens it
 * from the syllabuses tab when it is gone; a no-op when it is not.
 *
 * Every locator here filters to visible (#495): counting hidden leftovers made
 * this report an already-open dialog when the only match was in a tab the test
 * had left, and the click that followed then waited out the whole test timeout
 * on an element that could never become visible.
 */
export async function ensureModuleDialogOpen(
    page: Page,
    eventTitle?: string,
): Promise<void> {
    // Presence check is deliberately unfiltered: "is a module dialog open at
    // all" must not hinge on whether one title matched.
    if ((await visibleEditEventTrigger(page).count()) > 0) return;

    // Getting here means no usable trigger is on screen -- but a dialog may
    // still be open (a different module's, or one whose content did not
    // render). MUI marks everything behind an open modal `aria-hidden`, so the
    // tab below is not merely covered, it is absent from the accessibility
    // tree and `getByRole("tab", ...)` waits for it until the test times out.
    // That is the failure behind gantt-recurrence.spec.ts:459, which spent
    // its whole 60s budget on `waiting for getByRole('tab', ...)`.
    const openDialog = page.locator(".MuiDialog-root:visible");
    if ((await openDialog.count()) > 0) {
        await page.keyboard.press("Escape");
        await expect(openDialog).toHaveCount(0, { timeout: 10_000 });
    }

    await page.getByRole("tab", { name: "סילבוסים" }).click();

    // Tooltip+IconButton: MUI puts the label on the button, or on a wrapping
    // <span> — match either.
    const editModuleSelector =
        'button[aria-label="עריכת מערך"], span[title="עריכת מערך"] button, span[aria-label="עריכת מערך"] button';

    // Reopen a module the test actually owns. Every module lives in its own
    // ModuleRow <tr>, and the seeded breaks module ("הפסקות") sits above them,
    // so an unqualified `.first()` reopens *that* one and the caller's event is
    // nowhere inside it. The rest of the suite already excludes it by name
    // (`hasNotText: "הפסקות"`); this now does the same.
    const ownRow = page
        .locator("tr")
        .filter({ has: page.locator(editModuleSelector) })
        .filter({ hasNotText: "הפסקות" });
    const editModuleButton = (
        (await ownRow.count()) > 0 ? ownRow.first() : page
    )
        .locator(editModuleSelector)
        .first();
    await expect(editModuleButton).toBeVisible({ timeout: 10_000 });
    await editModuleButton.click();

    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 10_000 });
    await expect(visibleEditEventTrigger(page)).toBeVisible({ timeout: 10_000 });
}

/** Opens the event dialog for `eventTitle`, reopening the module dialog if needed. */
export async function openEventEditDialog(
    page: Page,
    eventTitle: string,
): Promise<Locator> {
    await ensureModuleDialogOpen(page, eventTitle);
    await (await resolveEditEventTrigger(page, eventTitle)).click();

    const eventDialog = page
        .getByRole("dialog")
        .filter({ hasText: `עריכת מופע: ${eventTitle}` });
    await expect(eventDialog).toBeVisible({ timeout: 10_000 });
    return eventDialog;
}

/** Closes the event dialog, then the module dialog behind it. */
export async function closeEventAndModuleDialogs(
    page: Page,
    eventDialog: Locator,
): Promise<void> {
    await eventDialog.getByRole("button", { name: "סגירה" }).click();
    await expect(eventDialog).not.toBeVisible();

    const moduleDialog = page.getByRole("dialog").first();
    if ((await moduleDialog.count()) > 0) {
        const closeButton = moduleDialog.getByRole("button", { name: "סגירה" });
        if ((await closeButton.count()) > 0) {
            await closeButton.click();
        } else {
            await page.keyboard.press("Escape");
        }

        // Wait for the dialog we just closed to actually go, rather than for a
        // fixed 300ms (#404). MUI marks content behind an open modal
        // `aria-hidden`, so while the exit transition runs
        // `getByRole("tab", ...)` matches nothing and the next helper's tab
        // click waits out the entire test timeout — the race behind the :402
        // and :435 flakes, both of which died on
        // `waiting for getByRole('tab', { name: 'סילבוסים' })` and passed on
        // retry. Scoped to this branch, and to the dialog this helper closed,
        // so an unrelated dialog elsewhere on the page is not asserted away.
        await expect(moduleDialog).not.toBeVisible({ timeout: 10_000 });
    }
}
