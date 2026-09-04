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

        const fabPopover = page.locator("[role='presentation']").filter({
            has: page.getByRole("button", { name: "גאנט חדש" }),
        });

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

            // Creating a draft selects it and closes the FAB popover, so the
            // list this test goes on to read is no longer mounted. Reopen it.
            //
            // This branch used to be near-dead: other specs left curricula
            // lying around, so the list was rarely empty. Now that each test
            // cleans up after itself (fixtures.ts) it runs every time, which
            // is what turned this spec flaky -- the isolation did not break
            // it, it exposed a path that was never really exercised.
            await fab.click();
            await page
                .locator(".MuiSkeleton-root")
                .waitFor({ state: "hidden", timeout: 10_000 })
                .catch(() => {});
        }

        // Select a curriculum: export is gated on `sourceCurriculum` being set
        // (CurriculumActionItems.tsx), so an unselected list leaves the trigger
        // permanently disabled.
        await expect(listItems.first()).toBeVisible({ timeout: 10_000 });
        await listItems.first().click();
        await waitForAppLoad(page);

        // Selecting a curriculum closes the panel on purpose —
        // handleSelectCurriculum calls handleClosePanel (curriculum-fab/index.tsx).
        // Wait for that close before reopening, otherwise the reopen races it and
        // the panel ends up shut. The Excel export lives only on this action bar.
        await expect(fabPopover).toHaveCount(0, { timeout: 10_000 });
        await fab.click();

        // Anchor on aria-haspopup, not on the label or the icon:
        //  - In its `iconOnly` form the trigger has no accessible name at all.
        //    ImportExportMenuButton wraps the IconButton in <Tooltip><span>, so
        //    "ייבוא / ייצוא" lands on the span. Only the non-iconOnly variant
        //    (syllabuses-actions-box, whose menu carries no Excel item) exposes
        //    that name, so an unscoped getByRole matches *that* button instead.
        //  - MUI drops `data-testid` from its icons in production builds, and
        //    these specs run against the production image, so the icon is out
        //    as an anchor too.
        const exportTrigger = fabPopover.locator('button[aria-haspopup="true"]');
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
