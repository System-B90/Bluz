import {
    test,
    expect,
    SELECTORS,
    openSettingsDialog,
    navigateToSettingsTab,
    gotoAppHome,
    testId,
} from "./fixtures";

/**
 * Room reservations, opened from the room settings tab.
 * Covers: creating a custom room, reserving it for a window, seeing the
 * reservation listed, and cancelling it. Cleans up the room afterwards.
 */

function pad(n: number): string {
    return String(n).padStart(2, "0");
}

/** `datetime-local` value N hours from now, formatted as the input expects. */
function hoursFromNow(hours: number): string {
    const d = new Date(Date.now() + hours * 60 * 60 * 1000);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

test.describe("Room reservations", () => {
    test.describe.configure({ timeout: 60_000 });

    test.beforeEach(async ({ page }) => {
        await gotoAppHome(page);
        await openSettingsDialog(page);
        await navigateToSettingsTab(page, "חדרים");
    });

    // Creation runs in a Mongo transaction; the test Mongo is a single-node
    // replica set (docker-compose.test.yml), so this covers the atomic path
    // rather than the standalone fallback (#649).
    test("creates a reservation for a room and cancels it", async ({
        page,
    }) => {
        const roomName = testId("resv-room");
        const dialog = page.locator(SELECTORS.settingsDialog).first();

        // Create a throwaway room to reserve.
        await dialog
            .getByRole("button", { name: "הוספת חדר מותאם אישית" })
            .click();
        await dialog.getByLabel("שם החדר").fill(roomName);
        await dialog.locator("form").getByRole("button", { name: "יצירת חדר" }).click();
        await expect(dialog.getByText(roomName)).toBeVisible({
            timeout: 10_000,
        });

        try {
            const roomRow = dialog.locator("li").filter({ hasText: roomName });
            await roomRow
                .getByRole("button", { name: "הזמנות חדר" })
                .click();

            const reservationDialog = page.getByRole("dialog").filter({
                hasText: `הזמנות חדר — ${roomName}`,
            });
            await expect(reservationDialog).toBeVisible();
            await expect(
                reservationDialog.getByText("אין הזמנות לחדר זה"),
            ).toBeVisible();

            await reservationDialog
                .getByLabel("התחלה")
                .fill(hoursFromNow(1));
            await reservationDialog.getByLabel("סיום").fill(hoursFromNow(2));
            await reservationDialog.getByLabel("מזהה מזמין").fill("1234567");
            await reservationDialog
                .getByRole("button", { name: "הזמן חדר" })
                .click();

            // The empty-state message is replaced by the new reservation row.
            await expect(
                reservationDialog.getByText("אין הזמנות לחדר זה"),
            ).toBeHidden();
            await expect(
                reservationDialog.getByText("מזמין: 1234567"),
            ).toBeVisible();
            // The row's booker-type chip, not the "סוג מזמין" select above
            // it, which shows the same word as its current value.
            await expect(
                reservationDialog.getByRole("listitem").getByText("מדריך"),
            ).toBeVisible();

            // Cancel it — back to the empty state.
            await reservationDialog
                .getByRole("button", { name: "ביטול הזמנה" })
                .click();
            await expect(
                reservationDialog.getByText("אין הזמנות לחדר זה"),
            ).toBeVisible();

            await reservationDialog
                .getByRole("button", { name: "סגירה" })
                .click();
            await expect(reservationDialog).toBeHidden();
        } finally {
            // Clean up the throwaway room.
            const roomRow = dialog.locator("li").filter({ hasText: roomName });
            const deleteButton = roomRow.getByRole("button", {
                name: "מחיקה",
            });
            if (await deleteButton.isVisible().catch(() => false)) {
                page.once("dialog", (d) => d.accept());
                await deleteButton.click();
                await page.waitForTimeout(500);
            }
        }
    });
});
