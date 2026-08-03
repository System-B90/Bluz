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
 * Custom colors (צבעים) CRUD in the settings dialog.
 * Covers: create, search/filter, edit, and delete via the confirm dialog,
 * plus validation for a missing name.
 */

test.describe("Custom colors settings", () => {
    test.describe.configure({ timeout: 60_000 });

    test.beforeEach(async ({ page }) => {
        await gotoAppHome(page);
        await openSettingsDialog(page);
        await navigateToSettingsTab(page, "צבעים");
    });

    test("creates, finds via search, and deletes a custom color", async ({
        page,
    }) => {
        const name = testId("color");
        const hex = "#00aabb";

        const dialog = page.locator(SELECTORS.settingsDialog).first();

        await dialog.getByRole("button", { name: "הוספת צבע חדש" }).click();

        await dialog.getByLabel("שם הצבע").fill(name);
        await dialog.getByLabel("קוד צבע (Hex)").fill(hex);

        await dialog.locator("form").getByRole("button", { name: "יצירת צבע" }).click();

        // Saved color appears in the list.
        await expect(dialog.getByText(name)).toBeVisible({ timeout: 10_000 });

        // Search narrows the list to the created entry.
        const searchInput = dialog.getByPlaceholder("חיפוש צבע...");
        await searchInput.fill(name);
        await expect(dialog.getByText(name)).toBeVisible();

        const otherColorCount = await dialog
            .locator("li")
            .filter({ hasNotText: name })
            .count();
        expect(otherColorCount).toBe(0);

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

        // The delete is optimistic locally but the list is also refreshed from
        // the websocket broadcast, so clearing the search too early can render
        // the pre-delete snapshot again. Gate on the server having confirmed
        // the delete rather than on a fixed wait.
        await expect(
            page.getByText(`מחיקת צבע ${name} הסתיימה בהצלחה.`),
        ).toBeVisible({ timeout: 10_000 });

        await searchInput.fill("");
        await expect(dialog.getByText(name)).toBeHidden({ timeout: 10_000 });
    });

    test("edits an existing custom color's hex value", async ({ page }) => {
        const name = testId("color-edit");
        const dialog = page.locator(SELECTORS.settingsDialog).first();

        await dialog.getByRole("button", { name: "הוספת צבע חדש" }).click();
        await dialog.getByLabel("שם הצבע").fill(name);
        await dialog.getByLabel("קוד צבע (Hex)").fill("#112233");
        await dialog.locator("form").getByRole("button", { name: "יצירת צבע" }).click();
        await expect(dialog.getByText(name)).toBeVisible({ timeout: 10_000 });

        try {
            await dialog.getByText(name).click();

            const updatedHex = "#445566";
            const hexField = dialog.getByLabel("קוד צבע (Hex)");
            await hexField.fill(updatedHex);
            await dialog.locator("form").getByRole("button", { name: "עדכון צבע" }).click();

            // Re-select to confirm the update persisted.
            await dialog.getByText(name).click();
            await expect(hexField).toHaveValue(updatedHex);
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

    test("blocks submission when the name field is empty", async ({
        page,
    }) => {
        // The name field is a required HTML input, so the browser's native
        // constraint validation blocks form submission before the app's own
        // "שם הצבע הוא שדה חובה" check ever runs.
        const dialog = page.locator(SELECTORS.settingsDialog).first();

        await dialog.getByRole("button", { name: "הוספת צבע חדש" }).click();
        await dialog.getByLabel("קוד צבע (Hex)").fill("#123456");

        await dialog.locator("form").getByRole("button", { name: "יצירת צבע" }).click();

        const nameInput = dialog.getByLabel("שם הצבע");
        await expect(nameInput).toHaveJSProperty("validity.valid", false);

        // Nothing was created: the create form is still open with the button
        // still reading "יצירת צבע" rather than resetting to placeholder state.
        await expect(
            dialog.locator("form").getByRole("button", { name: "יצירת צבע" }),
        ).toBeVisible();
    });

    test("shows validation error for an invalid hex code", async ({
        page,
    }) => {
        const name = testId("color-invalid");
        const dialog = page.locator(SELECTORS.settingsDialog).first();

        await dialog.getByRole("button", { name: "הוספת צבע חדש" }).click();
        await dialog.getByLabel("שם הצבע").fill(name);
        await dialog.getByLabel("קוד צבע (Hex)").fill("not-a-color");

        await dialog.locator("form").getByRole("button", { name: "יצירת צבע" }).click();

        await expect(
            page.getByText("קוד צבע חייב להיות בפורמט Hex תקין (למשל, #ffffff)"),
        ).toBeVisible();
    });
});
