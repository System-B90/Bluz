import { expect, Page } from "@playwright/test";

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

/**
 * Opens the settings dialog by clicking the gear icon in the AppBar.
 */
export async function openSettingsDialog(page: Page): Promise<void> {
    // The settings icon is an IconButton in the AppBar with a SettingsIcon child
    const settingsButton = page.locator(`${SELECTORS.appBar} button`).filter({
        has: page.locator("svg[data-testid='SettingsIcon']"),
    });
    await settingsButton.click();
    await page.waitForSelector(SELECTORS.settingsDialog, { state: "visible" });
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
 * Navigates to a specific settings tab by clicking its label.
 */
export async function navigateToSettingsTab(
    page: Page,
    tabLabel: string,
): Promise<void> {
    const dialog = page.locator(SELECTORS.settingsDialog).first();
    await dialog.getByText(tabLabel, { exact: true }).click();
    // Allow animation to complete
    await page.waitForTimeout(350);
}

/**
 * Waits for the page to be fully loaded after navigation.
 * Checks that the AppBar is visible as a signal the authenticated app loaded.
 */
export async function waitForAppLoad(page: Page): Promise<void> {
    await page.waitForLoadState("networkidle");
    await expect(page.locator(SELECTORS.appBar)).toBeVisible();
}

/**
 * Generates a unique test identifier to avoid collisions between test runs.
 */
export function testId(prefix: string = "test"): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).slice(2, 6);
    return `${prefix}-${timestamp}-${random}`;
}
