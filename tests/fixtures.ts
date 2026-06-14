import { expect, Locator, Page } from "@playwright/test";

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
    // The settings icon is an IconButton in the AppBar with a SettingsIcon child
    const settingsButton = page.locator(`${SELECTORS.appBar} button`).filter({
        has: page.locator("svg[data-testid='SettingsIcon']"),
    });
    for (let attempt = 0; attempt < 3; attempt++) {
        await settingsButton.click();
        try {
            await expect(
                page.getByRole("dialog").filter({ hasText: "הגדרות" }),
            ).toBeVisible({ timeout: 15_000 });
            return;
        } catch {
            if (attempt === 2) {
                throw new Error("Settings dialog did not open");
            }
        }
    }
}

/**
 * Closes the settings dialog by clicking its close button.
 */
export async function closeSettingsDialog(page: Page): Promise<void> {
    const dialog = page.locator(SELECTORS.settingsDialog).first();
    const closeButton = dialog.locator("button").filter({
        has: page.locator("svg[data-testid='CloseIcon']"),
    });
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
}

/**
 * Switches the calendar to day view.
 */
export async function switchToDayView(page: Page): Promise<void> {
    await page.getByRole("button", { name: "יום", exact: true }).click();
    await page.waitForTimeout(300);
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
}

/**
 * Returns the visible event dialog, if any.
 */
export function getEventDialog(page: Page) {
    return page.getByRole("dialog").filter({ hasText: "ערוך מופע" });
}

/**
 * Calendar filter strip in the AppBar (prayer/PA/misconfig icons live here).
 */
export function getHeaderFilters(page: Page) {
    return page
        .locator(SELECTORS.appBar)
        .locator("button:has(svg[data-testid='ChatIcon'])");
}

/**
 * Generates a unique test identifier to avoid collisions between test runs.
 */
export function testId(prefix: string = "test"): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).slice(2, 6);
    return `${prefix}-${timestamp}-${random}`;
}
