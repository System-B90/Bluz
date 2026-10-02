import { expect, gotoAppHome, SELECTORS, test, waitForAppLoad } from "./fixtures";

/**
 * Back from the gantt, the schedule flickered between today's week and the
 * week last viewed until a reload: the view and the calendar provider kept
 * resetting each other's range.
 */
test.describe("Schedule ↔ gantt navigation", () => {
    test.describe.configure({ timeout: 120_000 });

    test("returning from the gantt keeps the viewed week and stays put", async ({ page }) => {
        await gotoAppHome(page);
        await expect(page.locator(SELECTORS.calendarRoot)).toBeVisible({ timeout: 60_000 });
        await page.getByRole("button", { name: "שבוע", exact: true }).click();

        const label = page.locator("h6").filter({ hasText: /\d/ }).first();
        const thisWeek = await label.textContent();
        await page.getByRole("button", { name: "הבא" }).click();
        await page.getByRole("button", { name: "הבא" }).click();
        await expect(label).not.toHaveText(thisWeek ?? "");
        const viewedWeek = await label.textContent();

        const appBar = page.locator(SELECTORS.appBar);
        await appBar.getByRole("button", { name: "עבור לבניית גאנט" }).click();
        await waitForAppLoad(page);
        await appBar.getByRole("button", { name: 'חזור ללו"ז' }).click();
        await expect(page.locator(SELECTORS.calendarRoot)).toBeVisible({ timeout: 60_000 });

        await expect(label).toHaveText(viewedWeek ?? "");
        // A flicker changes the label many times a second; sample it.
        const seen = new Set<string>();
        for (let i = 0; i < 15; i++) {
            seen.add((await label.textContent()) ?? "");
            await page.waitForTimeout(200);
        }
        expect([ ...seen ], "the week label changed while idle").toEqual([ viewedWeek ]);
    });
});