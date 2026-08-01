import { test as baseTest, expect as baseExpect, Locator, Page, BrowserContext } from "@playwright/test";

// Shared page and context for visual mode (single-window reuse)
let sharedContext: BrowserContext | null = null;
let sharedPage: Page | null = null;

export const test = baseTest.extend({
    context: async ({ browser, contextOptions }, use) => {
        if (process.env.TEST_VISUAL === "1") {
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
        if (process.env.TEST_VISUAL === "1") {
            if (!sharedPage) {
                sharedPage = await context.newPage();
            }
            await use(sharedPage);
        } else {
            const page = await context.newPage();
            await use(page);
            await page.close();
        }
    }
});

export const expect = baseExpect;

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
