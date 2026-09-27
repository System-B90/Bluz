import type { Page } from "@playwright/test";

import { test, gotoAppHome, waitForAppLoad } from "./fixtures";

/**
 * Release screenshots. Not assertions: captures the main screens into
 * `release-screenshots/` (repo root), which e2e.yml uploads as an artifact and
 * release.yml attaches to the GitHub Release on `v*` tags. Keep the list in
 * step with the app's user-facing pages (see CLAUDE.md, "Release screenshots").
 */

const OUT_DIR = "release-screenshots";

async function shoot(page: Page, name: string): Promise<void>
{
    // Let data loads and fonts settle so the shot isn't a loading skeleton.
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
    await page.screenshot({ path: `${ OUT_DIR }/${ name }.png`, fullPage: true });
}

test.describe("Release screenshots", () => {
    test.describe.configure({ timeout: 60_000 });

    test("login", async ({ browser }) => {
        const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
        const page = await context.newPage();
        await page.goto("/login", { waitUntil: "domcontentloaded" });
        await shoot(page, "01-login");
        await context.close();
    });

    test("schedule", async ({ page }) => {
        await gotoAppHome(page);
        await shoot(page, "02-schedule");
    });

    test("gantt", async ({ page }) => {
        await page.goto("/gantt", { waitUntil: "commit", timeout: 60_000 });
        await waitForAppLoad(page);
        await shoot(page, "03-gantt");
    });
});
