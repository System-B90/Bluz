import { expect, gotoAppHome, navigateToSettingsTab, openSettingsDialog, SELECTORS, test } from "./fixtures";

/**
 * #779: the personal AI card offers the backend's models in a dropdown (with
 * free text when listing fails) and remembers the choice.
 */
test.describe("AI model discovery in personal settings", () => {
    test.describe.configure({ timeout: 90_000 });

    test("lists the backend's models, saves a pick, and restores it after reload", async ({ page, request }) => {
        await page.route("**/api/ai/models", (route) => route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ status: 0, data: { defaultModel: "kimi-k2", models: [ { id: "kimi-k2" }, { id: "qwen-3" } ] } }),
        }));

        try {
            await gotoAppHome(page);
            await openSettingsDialog(page);
            await navigateToSettingsTab(page, "אישי");
            const dialog = page.locator(SELECTORS.settingsDialog).first();
            const field = dialog.getByRole("combobox", { name: "מודל" });
            await expect(field).toHaveAttribute("placeholder", "kimi-k2");

            await field.click();
            await page.getByRole("option", { name: "qwen-3" }).click();
            await expect(field).toHaveValue("qwen-3");

            // Persisted server-side, not just in the field.
            await expect.poll(async () => (await (await request.get("/api/personal-settings")).json()).data?.aiModel, {
                timeout: 10_000,
            }).toBe("qwen-3");

            await gotoAppHome(page);
            await openSettingsDialog(page);
            await navigateToSettingsTab(page, "אישי");
            await expect(page.locator(SELECTORS.settingsDialog).first().getByRole("combobox", { name: "מודל" }))
                .toHaveValue("qwen-3");
        } finally {
            const current = (await (await request.get("/api/personal-settings")).json()).data;
            if (current) await request.put("/api/personal-settings", { data: { ...current, aiModel: "" } });
        }
    });

    test("falls back to free text and says why when listing fails", async ({ page }) => {
        await page.route("**/api/ai/models", (route) => route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ status: 0, data: { defaultModel: "kimi-k2", models: [], error: "TLS" } }),
        }));
        await gotoAppHome(page);
        await openSettingsDialog(page);
        await navigateToSettingsTab(page, "אישי");
        const dialog = page.locator(SELECTORS.settingsDialog).first();
        const field = dialog.getByRole("combobox", { name: "מודל" });
        await field.fill("custom-model");
        await expect(dialog.getByText("לא ניתן לטעון את רשימת המודלים (TLS)", { exact: false })).toBeVisible();
        await field.fill("");
    });
});