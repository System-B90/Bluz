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
 * Outsiders (אנשי חוץ) CRUD in the settings dialog.
 * Covers: create, search/filter, edit, and delete via the confirm dialog.
 */

test.describe("Outsiders settings", () => {
    test.describe.configure({ timeout: 60_000 });

    test.beforeEach(async ({ page }) => {
        await gotoAppHome(page);
        await openSettingsDialog(page);
        await navigateToSettingsTab(page, "אנשי חוץ");
    });

    test("creates, finds via search, and deletes an outsider", async ({
        page,
    }) => {
        const name = testId("outsider");
        const phone = "0501234567";

        const dialog = page.locator(SELECTORS.settingsDialog).first();

        await dialog.getByRole("button", { name: "הוספת איש חוץ" }).click();

        await dialog.getByLabel("שם מלא").fill(name);
        await dialog.getByLabel("מספר טלפון").fill(phone);

        await dialog.locator("form").getByRole("button", { name: "הוספת איש חוץ" }).click();

        // Saved outsider appears in the list.
        await expect(dialog.getByText(name)).toBeVisible({ timeout: 10_000 });

        // Search narrows the list to the created entry.
        const searchInput = dialog.getByPlaceholder("חיפוש איש חוץ...");
        await searchInput.fill(name);
        await expect(dialog.getByText(name)).toBeVisible();

        // Web-first, not a one-shot .count(): the search filter is debounced,
        // so counting immediately after typing can sample the list before it
        // settles and see rows that are about to disappear. toHaveCount retries
        // until it does, which is what made this spec flaky rather than wrong.
        await expect(
            dialog.locator("li").filter({ hasNotText: name }),
        ).toHaveCount(0, { timeout: 10_000 });

        // Delete via the confirm dialog.
        await dialog
            .locator("li")
            .filter({ hasText: name })
            .getByRole("button")
            .last()
            .click();

        const confirmDialog = page.getByRole("dialog", {
            name: "אישור פעולה",
        });
        await expect(confirmDialog).toBeVisible();
        await confirmDialog.getByRole("button", { name: "מחיקה" }).click();

        // Same shape as the custom-colors delete: the row is removed
        // optimistically but the list is also refreshed from the websocket
        // broadcast, so clearing the search too early can re-render the
        // pre-delete snapshot. Gate on the server, which is the condition the
        // assertion below actually depends on.
        await expect
            .poll(
                async () => {
                    const response = await page.request.get("/api/outsiders");
                    const body = await response.json();
                    return JSON.stringify(body.data ?? []).includes(name);
                },
                { timeout: 20_000 },
            )
            .toBe(false);

        await searchInput.fill("");
        await expect(dialog.getByText(name)).toBeHidden({ timeout: 10_000 });
    });

    test("edits an existing outsider's phone number", async ({ page }) => {
        const name = testId("outsider-edit");
        const dialog = page.locator(SELECTORS.settingsDialog).first();

        await dialog.getByRole("button", { name: "הוספת איש חוץ" }).click();
        await dialog.getByLabel("שם מלא").fill(name);
        await dialog.getByLabel("מספר טלפון").fill("0501234567");
        await dialog.locator("form").getByRole("button", { name: "הוספת איש חוץ" }).click();
        await expect(dialog.getByText(name)).toBeVisible({ timeout: 10_000 });

        try {
            await dialog.getByText(name).click();

            const updatedPhone = "0521112222";
            const phoneField = dialog.getByLabel("מספר טלפון");
            await phoneField.fill(updatedPhone);
            await dialog.getByRole("button", { name: "עדכון פרטים" }).click();

            // Re-select to confirm the update persisted.
            await dialog.getByText(name).click();
            await expect(phoneField).toHaveValue(updatedPhone);
        } finally {
            await dialog
                .locator("li")
                .filter({ hasText: name })
                .getByRole("button")
                .last()
                .click();
            const confirmDialog = page.getByRole("dialog", {
                name: "אישור פעולה",
            });
            if (await confirmDialog.isVisible().catch(() => false)) {
                await confirmDialog
                    .getByRole("button", { name: "מחיקה" })
                    .click();
            }
        }
    });

    test("shows validation error for an invalid phone number", async ({
        page,
    }) => {
        const dialog = page.locator(SELECTORS.settingsDialog).first();

        await dialog.getByRole("button", { name: "הוספת איש חוץ" }).click();
        await dialog.getByLabel("שם מלא").fill(testId("outsider-invalid"));
        await dialog.getByLabel("מספר טלפון").fill("123");

        await expect(dialog.getByText("מספר טלפון לא תקין")).toBeVisible();
    });
});
