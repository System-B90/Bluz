import { test, expect, gotoAppHome, waitForAppLoad } from "./fixtures";

/**
 * File export downloads (#554).
 *
 * Both exports are triggered via `window.open` on a route that sets
 * `Content-Disposition: attachment`, which Playwright surfaces as a real
 * `download` event — this asserts the browser actually receives a
 * non-empty, correctly named file rather than merely that the trigger
 * was clicked.
 */

test.describe("File exports", () => {
    test.describe.configure({ timeout: 60_000 });

    test("exports the schedule as a non-empty .ics via the command palette", async ({
        page,
    }) => {
        await gotoAppHome(page);

        // Open the command palette and run the ICS export command.
        await expect(async () => {
            await page
                .getByRole("button", { name: "פתיחת שורת הפקודות" })
                .click();
            await expect(
                page
                    .getByRole("dialog")
                    .filter({ has: page.getByRole("combobox") }),
            ).toBeVisible({ timeout: 2_000 });
        }).toPass({ timeout: 20_000 });

        const palette = page
            .getByRole("dialog")
            .filter({ has: page.getByRole("combobox") });
        await palette.getByRole("combobox").fill("ICS");

        const option = palette
            .getByRole("option")
            .filter({ hasText: "ייצוא ל-ICS" });
        await expect(option).toBeVisible();

        const [download] = await Promise.all([
            page.waitForEvent("download"),
            option.click(),
        ]);

        expect(download.suggestedFilename()).toMatch(/\.ics$/);

        const downloadPath = await download.path();
        expect(downloadPath, "download must have saved a file").toBeTruthy();
        const fs = await import("fs");
        const stats = fs.statSync(downloadPath!);
        expect(stats.size).toBeGreaterThan(0);

        const content = fs.readFileSync(downloadPath!, "utf-8");
        expect(content).toContain("BEGIN:VCALENDAR");
    });

    test("exports a curriculum as a non-empty .xlsx from the Gantt FAB", async ({
        page,
    }) => {
        await page.goto("/gantt");
        await waitForAppLoad(page);

        const fab = page.getByRole("button", { name: "גאנטים" });
        await fab.click();
        await page.waitForTimeout(500);

        await page
            .locator(".MuiSkeleton-root")
            .waitFor({ state: "hidden", timeout: 10_000 })
            .catch(() => {});

        const listItems = page
            .locator("[role='presentation'] ul li")
            .filter({ has: page.getByRole("button") });

        if ((await listItems.count()) === 0) {
            const createTrigger = page.getByRole("button", {
                name: "גאנט חדש",
            });
            await createTrigger.hover();
            const draftButton = page.locator(
                'span[title="דראפט חדש"] button, span[aria-label="דראפט חדש"] button',
            );
            await draftButton.click();
            await expect(page.getByText("הגאנט שלי").first()).toBeVisible({
                timeout: 10_000,
            });
        }

        // Select the curriculum so the export button targets it.
        await listItems
            .first()
            .click()
            .catch(() => {});
        await page.waitForTimeout(300);

        // The import/export trigger is the icon-only button labeled
        // "ייבוא / ייצוא" living beside the curriculum FAB actions.
        const exportTrigger = page.getByRole("button", {
            name: "ייבוא / ייצוא",
        });
        await expect(exportTrigger).toBeEnabled({ timeout: 10_000 });
        await exportTrigger.click();

        const excelItem = page.getByRole("menuitem", { name: "ייצוא לאקסל" });
        await expect(excelItem).toBeVisible();

        const [download] = await Promise.all([
            page.waitForEvent("download"),
            excelItem.click(),
        ]);

        expect(download.suggestedFilename()).toMatch(/\.xlsx$/);

        const downloadPath = await download.path();
        expect(downloadPath, "download must have saved a file").toBeTruthy();
        const fs = await import("fs");
        const stats = fs.statSync(downloadPath!);
        expect(stats.size).toBeGreaterThan(0);
    });
});
