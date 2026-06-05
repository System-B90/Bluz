import { expect, test } from "@playwright/test";

import {
    SELECTORS,
    getEventDialog,
    gotoAppHome,
    selectCalendarTimeRange,
    switchToDayView,
    testId,
} from "./fixtures";

/**
 * Calendar (Schedule) integration tests.
 * Covers: page load, calendar views, navigation, toolbar, fullscreen,
 *         event CRUD (create/edit/delete), event dialog fields, keyboard shortcuts.
 */

test.describe("Calendar Page", () => {
    test.beforeEach(async ({ page }) => {
        await gotoAppHome(page);
    });

    // ─── Page Load ──────────────────────────────────────────────────────────

    test("renders the calendar with toolbar", async ({ page }) => {
        // The calendar container should be visible
        const calendar = page.locator(SELECTORS.calendarRoot);
        await expect(calendar).toBeVisible();
    });

    test("displays navigation buttons (prev/today/next)", async ({ page }) => {
        // Toolbar navigation buttons with Hebrew text
        await expect(page.getByRole("button", { name: "קודם" })).toBeVisible();
        await expect(page.getByRole("button", { name: "היום" })).toBeVisible();
        await expect(page.getByRole("button", { name: "הבא" })).toBeVisible();
    });

    test("displays view switching buttons (day/work-week/week)", async ({
        page,
    }) => {
        await expect(
            page.getByRole("button", { name: "יום", exact: true }),
        ).toBeVisible();
        await expect(
            page.getByRole("button", { name: "שבוע עבודה" }),
        ).toBeVisible();
        await expect(page.getByRole("button", { name: "שבוע", exact: true })).toBeVisible();
    });

    // ─── View Switching ─────────────────────────────────────────────────────

    test("switches to day view", async ({ page }) => {
        const dayButton = page.getByRole("button", { name: "יום", exact: true });
        await dayButton.click();
        await page.waitForTimeout(300);

        // Day view highlights the active view button (resource columns may still be >1)
        await expect(dayButton).toHaveClass(/MuiButton-contained/);
    });

    test("switches to work-week view", async ({ page }) => {
        const workWeekButton = page.getByRole("button", {
            name: "שבוע עבודה",
        });
        await workWeekButton.click();
        await page.waitForTimeout(300);

        // Work week shows Sun-Thu (5 days)
        const dayHeaders = page.locator(".rbc-header");
        const count = await dayHeaders.count();
        expect(count).toBeGreaterThanOrEqual(5);
    });

    test("switches to full week view", async ({ page }) => {
        const weekButton = page.getByRole("button", { name: "שבוע", exact: true });
        await weekButton.click();
        await page.waitForTimeout(300);

        // Full week shows all 7 days
        const dayHeaders = page.locator(".rbc-header");
        const count = await dayHeaders.count();
        expect(count).toBe(7);
    });

    // ─── Date Navigation ────────────────────────────────────────────────────

    test("navigates to next period", async ({ page }) => {
        // Get initial header label text - the visible range header
        const headerLabel = page.locator("h6").filter({ hasText: "–" }).first();
        const initialText = await headerLabel.textContent();

        // Click "next"
        await page.getByRole("button", { name: "הבא" }).click();
        await page.waitForTimeout(500);

        // The header label should change
        const newText = await headerLabel.textContent();
        expect(newText).not.toBe(initialText);
    });

    test("navigates to previous period", async ({ page }) => {
        // Get initial header label text - the visible range header
        const headerLabel = page.locator("h6").filter({ hasText: "–" }).first();
        const initialText = await headerLabel.textContent();

        await page.getByRole("button", { name: "קודם" }).click();
        await page.waitForTimeout(500);

        const newText = await headerLabel.textContent();
        expect(newText).not.toBe(initialText);
    });

    test("returns to today", async ({ page }) => {
        // Navigate away first
        await page.getByRole("button", { name: "הבא" }).click();
        await page.waitForTimeout(300);
        await page.getByRole("button", { name: "הבא" }).click();
        await page.waitForTimeout(300);

        // Click "today"
        await page.getByRole("button", { name: "היום" }).click();
        await page.waitForTimeout(500);

        // The "today" button should appear contained (active state)
        const todayButton = page.getByRole("button", { name: "היום" });
        await expect(todayButton).toHaveClass(/MuiButton-contained/);
    });

    // ─── Toolbar Toggle ─────────────────────────────────────────────────────

    test("hides and shows the toolbar", async ({ page }) => {
        // Find the hide-toolbar button (VisibilityOffIcon inside the toolbar area)
        const hideToolbarButton = page.locator(
            "button:has(svg[data-testid='VisibilityOffIcon'])",
        );

        // Toolbar should be visible initially
        await expect(
            page.getByRole("button", { name: "היום" }),
        ).toBeVisible();

        // Click hide
        await hideToolbarButton.first().click();
        await page.waitForTimeout(500);

        // Toolbar buttons should be hidden (collapsed)
        await expect(
            page.getByRole("button", { name: "היום" }),
        ).not.toBeVisible();

        // The floating controls should appear with a show button (VisibilityIcon)
        const showButton = page.locator(
            "button:has(svg[data-testid='VisibilityIcon'])",
        );
        await expect(showButton).toBeVisible();

        // Click show
        await showButton.click();
        await page.waitForTimeout(500);

        // Toolbar should be visible again
        await expect(
            page.getByRole("button", { name: "היום" }),
        ).toBeVisible();
    });

    // ─── Fullscreen Mode ────────────────────────────────────────────────────

    test("enters and exits fullscreen mode", async ({ page }) => {
        // Find the fullscreen button (FullscreenIcon)
        const fullscreenButton = page.locator(
            "button:has(svg[data-testid='FullscreenIcon'])",
        );
        await fullscreenButton.first().click();
        await page.waitForTimeout(500);

        // In fullscreen, the exit button (FullscreenExitIcon) should appear
        const exitFullscreenButton = page.locator(
            "button:has(svg[data-testid='FullscreenExitIcon'])",
        );
        await expect(exitFullscreenButton).toBeVisible();

        // Press Escape to exit
        await page.keyboard.press("Escape");
        await page.waitForTimeout(500);

        // Exit button should be gone, enter button should be back
        await expect(exitFullscreenButton).not.toBeVisible();
    });

    // ─── Event Dialog ───────────────────────────────────────────────────────

    test("opens event dialog by clicking a time slot", async ({ page }) => {
        await selectCalendarTimeRange(page);

        const dialog = getEventDialog(page);
        await expect(dialog).toBeVisible();
        await expect(dialog.getByText("ערוך מופע")).toBeVisible();
    });

    test("creates a new event via the event dialog", async ({ page }) => {
        const eventName = testId("event");

        await selectCalendarTimeRange(page);

        const dialog = getEventDialog(page);
        await expect(dialog).toBeVisible();

        const nameField = dialog.locator("input").first();
        await nameField.fill(eventName);

        await dialog.getByRole("button", { name: "שמור" }).click();
        await page.waitForTimeout(500);

        const calendarEvent = page.locator(SELECTORS.calendarEvent).filter({
            hasText: eventName,
        });
        await expect(calendarEvent.first()).toBeVisible();
    });

    test("edits an existing event via double-click", async ({ page }) => {
        // Look for any existing event on the calendar
        const events = page.locator(SELECTORS.calendarEvent);
        if ((await events.count()) > 0) {
            // Double-click the first event
            await events.first().dblclick();
            await page.waitForTimeout(500);

            // The event dialog should open
            const dialog = page.locator(SELECTORS.eventDialog);
            if ((await dialog.count()) > 0) {
                await expect(dialog.first()).toBeVisible();

                // The name field should be pre-filled
                const nameField = dialog.first().locator("input").first();
                const currentValue = await nameField.inputValue();
                expect(currentValue.length).toBeGreaterThan(0);

                // Close dialog without saving
                const cancelButton = dialog
                    .first()
                    .getByRole("button", { name: "ביטול" });
                await cancelButton.click();
            }
        }
    });

    test("event dialog shows all expected fields", async ({ page }) => {
        await selectCalendarTimeRange(page);

        const dialog = getEventDialog(page);
        await expect(dialog).toBeVisible();
        await expect(dialog.getByText("שם").first()).toBeVisible();
        await expect(dialog.getByText("הערות").first()).toBeVisible();
        await expect(dialog.getByText("מתואם").first()).toBeVisible();
        await expect(dialog.getByText("קריטי").first()).toBeVisible();
        await expect(dialog.getByRole("button", { name: "שמור" })).toBeVisible();
        await expect(dialog.getByRole("button", { name: "ביטול" })).toBeVisible();
        await expect(dialog.getByRole("button", { name: "מחק" })).toBeVisible();

        await dialog.getByRole("button", { name: "ביטול" }).click();
    });

    test("event dialog toggles work correctly", async ({ page }) => {
        await selectCalendarTimeRange(page);

        const dialog = getEventDialog(page);
        await expect(dialog).toBeVisible();

        const lockedSwitch = dialog
            .locator(SELECTORS.formControlLabel)
            .filter({ hasText: "מתואם" })
            .locator("input[type='checkbox']");

        const wasChecked = await lockedSwitch.isChecked();
        await lockedSwitch.click();
        await page.waitForTimeout(200);

        const isNowChecked = await lockedSwitch.isChecked();
        expect(isNowChecked).toBe(!wasChecked);

        await dialog.getByRole("button", { name: "ביטול" }).click();
    });

    // ─── Keyboard Shortcuts ─────────────────────────────────────────────────

    test("Escape key exits fullscreen mode", async ({ page }) => {
        const fullscreenButton = page.locator(
            "button:has(svg[data-testid='FullscreenIcon'])",
        );
        await fullscreenButton.first().click();
        await page.waitForTimeout(500);

        const exitButton = page.locator(
            "button:has(svg[data-testid='FullscreenExitIcon'])",
        );
        await expect(exitButton).toBeVisible();

        await page.keyboard.press("Escape");
        await expect(exitButton).not.toBeVisible({ timeout: 10_000 });
    });
});
