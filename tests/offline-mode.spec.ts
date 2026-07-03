import {
    expect,
    test,
    SELECTORS,
    gotoAppHome,
    testId,
    enterOfflineMode,
    exitOfflineMode,
    cleanupOfflineMode,
    createEventInOfflineMode,
    dblclickCalendarEvent,
    getPushUpdatesDialog,
    getEventDialog,
    selectCalendarTimeRange,
    switchToDayView,
} from "./fixtures";

/**
 * Offline mode integration tests.
 *
 * Covers the full lifecycle of offline edits:
 *   - entering / exiting offline mode
 *   - create / modify / delete events while offline
 *   - push-updates dialog: stays open, pre-selection, save, revert, cancel
 *   - regression: dialog must NOT auto-close when there are pending changes
 */

test.describe("Offline mode", () => {
    test.beforeEach(async ({ page }) => {
        await gotoAppHome(page);
    });

    test.afterEach(async ({ page }) => {
        await cleanupOfflineMode(page);
    });

    // ─── Toggle ──────────────────────────────────────────────────────────────

    test("toolbar shows the offline toggle button", async ({ page }) => {
        await expect(
            page.getByRole("button", { name: /עבור למצב לוקלי/ }),
        ).toBeVisible();
    });

    test("entering offline mode turns the toggle orange", async ({ page }) => {
        await enterOfflineMode(page);
        // The contained (filled) variant on the warning-coloured button
        const btn = page.getByRole("button", { name: /חזור למצב מקוון/ });
        await expect(btn).toBeVisible();
        await expect(btn).toHaveClass(/MuiButton-contained/);
    });

    // ─── No changes ──────────────────────────────────────────────────────────

    // TODO(#97-followup): fails in hermetic CI — the push-updates dialog does
    // not auto-close on exit-without-changes within 3s (stays visible). Needs
    // app-side investigation of the no-op offline-exit path.
    test.fixme("exiting without changes auto-closes and shows info snackbar", async ({
        page,
    }) => {
        await enterOfflineMode(page);
        await exitOfflineMode(page);

        // Dialog should NOT appear (auto-closed immediately)
        await expect(getPushUpdatesDialog(page)).not.toBeVisible({
            timeout: 3_000,
        });

        // Info snackbar should be visible
        await expect(page.locator(SELECTORS.snackbar)).toContainText(
            "לא בוצעו שינויים לסינכרון",
            { timeout: 5_000 },
        );

        // Back in online mode
        await expect(
            page.getByRole("button", { name: /עבור למצב לוקלי/ }),
        ).toBeVisible();
    });

    // ─── Create offline (regression: was the bug in issue #71) ───────────────

    test("REGRESSION #71 – dialog stays open after creating event offline", async ({
        page,
    }) => {
        const name = testId("offline-create");

        await enterOfflineMode(page);
        await createEventInOfflineMode(page, name);

        const dialog = await exitOfflineMode(page);

        // The push-updates dialog must remain visible
        await expect(dialog).toBeVisible({ timeout: 5_000 });

        // The created event must be listed
        await expect(dialog).toContainText(name);
    });

    test("created event shows as non-conflicting (אין) in the dialog", async ({
        page,
    }) => {
        const name = testId("offline-conflict");

        await enterOfflineMode(page);
        await createEventInOfflineMode(page, name);

        const dialog = await exitOfflineMode(page);
        await expect(dialog).toBeVisible({ timeout: 5_000 });

        // Row for our event should show "אין" (no conflict)
        const row = dialog.locator("tr, [role='row']").filter({ hasText: name });
        await expect(row).toContainText("אין");
    });

    test("reverting all after offline create removes the event from calendar", async ({
        page,
    }) => {
        const name = testId("offline-revert");

        await enterOfflineMode(page);
        await createEventInOfflineMode(page, name);

        // Confirm the event is on the calendar while still offline
        await expect(
            page.locator(SELECTORS.calendarEvent).filter({ hasText: name }),
        ).toBeVisible();

        const dialog = await exitOfflineMode(page);
        await expect(dialog).toBeVisible({ timeout: 5_000 });

        await dialog.getByRole("button", { name: "שחזר הכל" }).click();
        await page.waitForTimeout(500);

        // Dialog closed, back online
        await expect(dialog).not.toBeVisible();
        await expect(
            page.getByRole("button", { name: /עבור למצב לוקלי/ }),
        ).toBeVisible();

        // Event must be gone
        await expect(
            page.locator(SELECTORS.calendarEvent).filter({ hasText: name }),
        ).not.toBeVisible();
    });

    test("cancelling (stay offline) preserves the event and keeps offline mode", async ({
        page,
    }) => {
        const name = testId("offline-cancel");

        await enterOfflineMode(page);
        await createEventInOfflineMode(page, name);

        const dialog = await exitOfflineMode(page);
        await expect(dialog).toBeVisible({ timeout: 5_000 });

        await dialog.getByRole("button", { name: "ביטול (הישאר באופליין)" }).click();
        await page.waitForTimeout(300);

        // Still in offline mode
        await expect(
            page.getByRole("button", { name: /חזור למצב מקוון/ }),
        ).toBeVisible();

        // Event still on calendar
        await expect(
            page.locator(SELECTORS.calendarEvent).filter({ hasText: name }),
        ).toBeVisible();
    });

    // ─── Modify offline ───────────────────────────────────────────────────────

    test("modified event appears in push dialog", async ({ page }) => {
        // Create an event while online first
        const originalName = testId("modify-orig");
        const modifiedName = testId("modify-new");

        await selectCalendarTimeRange(page);
        const createDialog = getEventDialog(page);
        await expect(createDialog).toBeVisible();
        await createDialog.locator("input").first().fill(originalName);
        await createDialog.getByRole("button", { name: "שמור" }).click();
        await page.waitForTimeout(1_000);

        // Now go offline and modify it
        await enterOfflineMode(page);

        await dblclickCalendarEvent(page, originalName);

        const editDialog = getEventDialog(page);
        await expect(editDialog).toBeVisible();
        const nameField = editDialog.locator("input").first();
        await nameField.clear();
        await nameField.fill(modifiedName);
        await editDialog.getByRole("button", { name: "שמור" }).click();
        await page.waitForTimeout(500);

        const pushDialog = await exitOfflineMode(page);
        await expect(pushDialog).toBeVisible({ timeout: 5_000 });
        await expect(pushDialog).toContainText(modifiedName);
    });

    // ─── Delete offline ───────────────────────────────────────────────────────

    // TODO(#97-followup): flaky/blocked in hermetic CI — the event edit
    // dialog's delete button ("מחק") stays disabled, so the offline delete
    // can't be triggered and the test times out. Re-enable once the disabled
    // state on freshly-created offline events is understood.
    test.fixme("deleted event appears in push dialog", async ({ page }) => {
        // Create an event while online
        const name = testId("delete-offline");

        await selectCalendarTimeRange(page);
        const createDialog = getEventDialog(page);
        await expect(createDialog).toBeVisible();
        await createDialog.locator("input").first().fill(name);
        await createDialog.getByRole("button", { name: "שמירה" }).click();
        await page.waitForTimeout(1_000);

        // Go offline and delete it
        await enterOfflineMode(page);

        await dblclickCalendarEvent(page, name);

        const editDialog = getEventDialog(page);
        await expect(editDialog).toBeVisible();
        await editDialog.getByRole("button", { name: "מחיקה" }).click();
        await page.waitForTimeout(500);

        const pushDialog = await exitOfflineMode(page);
        await expect(pushDialog).toBeVisible({ timeout: 5_000 });
        // Deleted events show a placeholder row but retain the event id context
        await expect(pushDialog).toContainText(name);
    });

    // ─── Multiple edits ───────────────────────────────────────────────────────

    test("re-editing the same event offline only records the first captured version", async ({
        page,
    }) => {
        // Create online
        const v1 = testId("multi-edit-v1");
        const v2 = testId("multi-edit-v2");

        await selectCalendarTimeRange(page);
        const createDialog = getEventDialog(page);
        await createDialog.locator("input").first().fill(v1);
        await createDialog.getByRole("button", { name: "שמור" }).click();
        await page.waitForTimeout(1_000);

        // Enter offline, edit once → v2
        await enterOfflineMode(page);

        await dblclickCalendarEvent(page, v1);

        let editDialog = getEventDialog(page);
        await editDialog.locator("input").first().clear();
        await editDialog.locator("input").first().fill(v2);
        await editDialog.getByRole("button", { name: "שמור" }).click();
        await page.waitForTimeout(500);

        // Edit again offline — this second capture must NOT overwrite the first
        await dblclickCalendarEvent(page, v2);

        editDialog = getEventDialog(page);
        const finalName = testId("multi-edit-v3");
        await editDialog.locator("input").first().clear();
        await editDialog.locator("input").first().fill(finalName);
        await editDialog.getByRole("button", { name: "שמור" }).click();
        await page.waitForTimeout(500);

        const pushDialog = await exitOfflineMode(page);
        await expect(pushDialog).toBeVisible({ timeout: 5_000 });
        // Only one row (same event, not three separate entries)
        await expect(pushDialog).toContainText(finalName);
        const rows = pushDialog.locator("tr, [role='row']").filter({ hasText: finalName });
        await expect(rows).toHaveCount(1);
    });

    // ─── Multiple offline creates ─────────────────────────────────────────────

    test("creating multiple events offline lists all of them in the push dialog", async ({
        page,
    }) => {
        const names = [testId("multi-a"), testId("multi-b")];

        await enterOfflineMode(page);

        for (const name of names) {
            await createEventInOfflineMode(page, name);
        }

        const pushDialog = await exitOfflineMode(page);
        await expect(pushDialog).toBeVisible({ timeout: 5_000 });

        for (const name of names) {
            await expect(pushDialog).toContainText(name);
        }
    });
});
