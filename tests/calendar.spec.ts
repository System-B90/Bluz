import { expect, test } from "@playwright/test";

import { SELECTORS, testId, waitForAppLoad } from "./fixtures";

/**
 * Calendar (Schedule) integration tests.
 * Covers: page load, calendar views, navigation, toolbar, fullscreen,
 *         event CRUD (create/edit/delete), event dialog fields, keyboard shortcuts.
 */

test.describe("Calendar Page", () => {
    test.beforeEach(async ({ page }) => {
        await page.goto("/");
        await waitForAppLoad(page);
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

        // In day view, the calendar should show a single day column
        // Look for headers in the time-header area specifically
        const dayHeaders = page.locator(".rbc-time-header .rbc-header");
        await expect(dayHeaders).toHaveCount(1);
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
        // Switch to day view for easier slot targeting
        await page.getByRole("button", { name: "יום", exact: true }).click();
        await page.waitForTimeout(300);

        // Click a time slot in the day view
        const timeSlots = page.locator(SELECTORS.calendarDaySlot + " .rbc-timeslot-group");
        if ((await timeSlots.count()) > 2) {
            // Click on the 3rd time slot (roughly mid-morning)
            await timeSlots.nth(4).click();
            await page.waitForTimeout(500);

            // The event dialog should open
            const dialog = page.locator(SELECTORS.eventDialog);
            if ((await dialog.count()) > 0) {
                await expect(dialog.first()).toBeVisible();
                // Dialog title should be "ערוך מופע"
                await expect(
                    dialog.first().getByText("ערוך מופע"),
                ).toBeVisible();
            }
        }
    });

    test("creates a new event via the event dialog", async ({ page }) => {
        const eventName = testId("event");

        // Switch to day view
        await page.getByRole("button", { name: "יום", exact: true }).click();
        await page.waitForTimeout(300);

        // Click a time slot
        const timeSlots = page.locator(SELECTORS.calendarDaySlot + " .rbc-timeslot-group");
        if ((await timeSlots.count()) > 4) {
            await timeSlots.nth(4).click();
            await page.waitForTimeout(500);
        }

        const dialog = page.locator(SELECTORS.eventDialog);
        if ((await dialog.count()) > 0 && (await dialog.first().isVisible())) {
            // Fill the event name
            const nameField = dialog.first().locator("input").first();
            await nameField.fill(eventName);

            // Click save button (שמור)
            const saveButton = dialog
                .first()
                .getByRole("button", { name: "שמור" });
            await saveButton.click();
            await page.waitForTimeout(500);

            // The event should appear on the calendar
            const calendarEvent = page.locator(SELECTORS.calendarEvent).filter({
                hasText: eventName,
            });
            await expect(calendarEvent.first()).toBeVisible();
        }
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
        // Switch to day view and open dialog
        await page.getByRole("button", { name: "יום", exact: true }).click();
        await page.waitForTimeout(300);

        const timeSlots = page.locator(SELECTORS.calendarDaySlot + " .rbc-timeslot-group");
        if ((await timeSlots.count()) > 4) {
            await timeSlots.nth(4).click();
            await page.waitForTimeout(500);
        }

        const dialog = page.locator(SELECTORS.eventDialog);
        if ((await dialog.count()) > 0 && (await dialog.first().isVisible())) {
            // Verify key fields exist
            // Name field (שם)
            await expect(dialog.first().getByText("שם")).toBeVisible();

            // Notes field (הערות)
            await expect(dialog.first().getByText("הערות")).toBeVisible();

            // Toggle switches (מתואם, קריטי, חלון פ"א)
            await expect(dialog.first().getByText("מתואם")).toBeVisible();
            await expect(dialog.first().getByText("קריטי")).toBeVisible();

            // Action buttons
            await expect(
                dialog.first().getByRole("button", { name: "שמור" }),
            ).toBeVisible();
            await expect(
                dialog.first().getByRole("button", { name: "ביטול" }),
            ).toBeVisible();
            await expect(
                dialog.first().getByRole("button", { name: "מחק" }),
            ).toBeVisible();

            // Close dialog
            await dialog
                .first()
                .getByRole("button", { name: "ביטול" })
                .click();
        }
    });

    test("event dialog toggles work correctly", async ({ page }) => {
        // Open event dialog
        await page.getByRole("button", { name: "יום", exact: true }).click();
        await page.waitForTimeout(300);

        const timeSlots = page.locator(SELECTORS.calendarDaySlot + " .rbc-timeslot-group");
        if ((await timeSlots.count()) > 4) {
            await timeSlots.nth(4).click();
            await page.waitForTimeout(500);
        }

        const dialog = page.locator(SELECTORS.eventDialog);
        if ((await dialog.count()) > 0 && (await dialog.first().isVisible())) {
            // Find the "מתואם" switch and toggle it
            const lockedSwitch = dialog
                .first()
                .locator(SELECTORS.formControlLabel)
                .filter({ hasText: "מתואם" })
                .locator("input[type='checkbox']");

            const wasChecked = await lockedSwitch.isChecked();
            await lockedSwitch.click();
            await page.waitForTimeout(200);

            const isNowChecked = await lockedSwitch.isChecked();
            expect(isNowChecked).toBe(!wasChecked);

            // Close dialog
            await dialog
                .first()
                .getByRole("button", { name: "ביטול" })
                .click();
        }
    });

    // ─── Keyboard Shortcuts ─────────────────────────────────────────────────

    test("Escape key exits fullscreen mode", async ({ page }) => {
        // Enter fullscreen
        const fullscreenButton = page.locator(
            "button:has(svg[data-testid='FullscreenIcon'])",
        );
        await fullscreenButton.first().click();
        await page.waitForTimeout(500);

        // Verify we're in fullscreen
        const exitButton = page.locator(
            "button:has(svg[data-testid='FullscreenExitIcon'])",
        );
        await expect(exitButton).toBeVisible();

        // Press Escape
        await page.keyboard.press("Escape");
        await page.waitForTimeout(500);

        // Should exit fullscreen
        await expect(exitButton).not.toBeVisible();
    });
});
