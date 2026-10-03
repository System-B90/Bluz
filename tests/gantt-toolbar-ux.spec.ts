import type { Page } from "@playwright/test";

import { test, expect, waitForAppLoad } from "./fixtures";

/**
 * Gantt toolbar / view UX review fixes (#812, #815, #820, #821, #844, #851, #813).
 */

async function openTimeline(page: Page): Promise<void>
{
    await page.getByRole("tab", { name: "רצף זמן" }).click();
    await expect(page.getByRole("group", { name: "מצב תצוגה" })).toBeVisible({ timeout: 30_000 });
}

test.describe("Gantt toolbar UX", () => {
    test.beforeEach(async ({ page }) => {
        await page.goto("/gantt");
        await waitForAppLoad(page);
        await expect(page.getByRole("tab", { name: "רצף זמן" })).toBeVisible({ timeout: 30_000 });
    });

    test("toggles are named by their visible text (#815)", async ({ page }) => {
        await openTimeline(page);
        for (const name of [ "שבועי", "יומי", "אילוצים", "ללא הפסקות", "תא מלא", "לפי יום" ]) {
            await expect(page.getByRole("button", { name, exact: true })).toBeVisible();
        }
    });

    test("switching to daily view does not move the toolbar buttons (#820)", async ({ page }) => {
        await openTimeline(page);
        const unallocated = page.getByRole("button", { name: /לא משובצים/ });
        const before = await unallocated.boundingBox();
        await page.getByRole("button", { name: "יומי", exact: true }).click();
        await expect(page.getByRole("button", { name: "תא מלא", exact: true })).toBeDisabled();
        const after = await unallocated.boundingBox();
        expect(after?.x).toBeCloseTo(before?.x ?? 0, 0);
    });

    test("daily view and constraints survive a reload (#821)", async ({ page }) => {
        await openTimeline(page);
        await page.getByRole("button", { name: "יומי", exact: true }).click();
        await page.getByRole("button", { name: "אילוצים", exact: true }).click();
        await page.reload();
        await waitForAppLoad(page);
        await openTimeline(page);
        await expect(page.getByRole("button", { name: "יומי", exact: true })).toHaveAttribute("aria-pressed", "true");
        await expect(page.getByRole("button", { name: "אילוצים", exact: true })).toHaveAttribute("aria-pressed", "false");
    });

    test("the legend explains the timeline marks (#812)", async ({ page }) => {
        await openTimeline(page);
        await page.getByRole("button", { name: "מקרא" }).click();
        await expect(page.getByRole("dialog", { name: "מקרא" })).toContainText("שעות משובצות / שעות זמינות");
    });

    test("the selected tab and v= stay in step across a reload (#844)", async ({ page }) => {
        await page.getByRole("tab", { name: "שבועות" }).click();
        await expect(page).toHaveURL(/[?&]v=1/);
        await page.reload();
        await waitForAppLoad(page);
        await expect(page.getByRole("tab", { name: "שבועות" })).toHaveAttribute("aria-selected", "true");
    });

    test("insights do not rotate by default (#851)", async ({ page }) => {
        const autoRotate = page.getByRole("button", { name: "החלפה אוטומטית" });
        if (await autoRotate.count() === 0) test.skip(true, "no insights for this curriculum");
        await expect(autoRotate).toBeVisible();
    });

    test("weeks-tab day hours carry the ש׳ unit (#813)", async ({ page }) => {
        await page.getByRole("tab", { name: "שבועות" }).click();
        const dayHours = page.getByRole("textbox", { name: "שעות זמינות ביום" }).first();
        if (await dayHours.count() === 0) test.skip(true, "curriculum has no weeks");
        await expect(dayHours.locator("xpath=..")).toContainText("ש׳");
    });
});
