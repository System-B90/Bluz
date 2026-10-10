import type { Page } from "@playwright/test";

import { test, expect, waitForAppLoad, waitForHydration } from "./fixtures";
import { createHoursCourseFixture, deleteCourses } from "./hours-course-fixture";

/**
 * Release screenshots. Captures the main screens into
 * `release-screenshots/` (repo root), which e2e.yml uploads as an artifact and
 * release.yml attaches to the GitHub Release on `v*` tags. Keep the list in
 * step with the app's user-facing pages (see CLAUDE.md, "Release screenshots").
 *
 * The only assertion is that the page was actually served: a 5xx (e.g. an
 * nginx 502 page) fails the test instead of shipping as a "screenshot".
 */

const OUT_DIR = "release-screenshots";

/** Navigates, retrying 5xx responses for up to ~30s while the stack warms up. */
async function open(page: Page, url: string): Promise<void>
{
    let status = 0;
    for (let attempt = 0; attempt < 10; attempt++)
    {
        const res = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
        status = res?.status() ?? 0;
        if (status > 0 && status < 500)
        {
            break;
        }
        await page.waitForTimeout(3_000);
    }
    expect(status, `${ url } was not served (HTTP ${ status })`).toBeLessThan(500);
}

async function shoot(page: Page, name: string): Promise<void>
{
    // Not `networkidle`: the app holds a WebSocket open, so it never idles
    // (see waitForHydration). Hydration plus a short settle covers data loads.
    await waitForHydration(page);
    // Bounded: a panel that never resolves still gets captured.
    await expect(page.locator(".MuiSkeleton-root, [role='progressbar']"))
        .toHaveCount(0, { timeout: 30_000 })
        .catch(() => {});
    await page.waitForTimeout(1_000);
    await page.screenshot({ path: `${ OUT_DIR }/${ name }.png`, fullPage: true });
}

test.describe("Release screenshots", () => {
    test.describe.configure({ timeout: 90_000 });

    test("login", async ({ browser }) => {
        const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
        const page = await context.newPage();
        await open(page, "/login");
        await shoot(page, "01-login");
        await context.close();
    });

    test("schedule", async ({ page }) => {
        await open(page, "/");
        await waitForAppLoad(page);
        await shoot(page, "02-schedule");
    });

    test("gantt", async ({ page }) => {
        await open(page, "/gantt");
        await waitForAppLoad(page);
        await shoot(page, "03-gantt");
    });

    // The timeline toolbar and week headers changed in the UX review
    // (#812, #815, #820): legend, quieter warnings, fixed-position toggles.
    test("gantt timeline", async ({ page }) => {
        await open(page, "/gantt");
        await waitForAppLoad(page);
        await page.getByRole("tab", { name: "רצף זמן" }).click();
        await page.getByRole("group", { name: "מצב תצוגה" }).waitFor({ timeout: 30_000 });
        await shoot(page, "06-gantt-timeline");
        await page.getByRole("button", { name: "מקרא" }).click();
        await page.getByRole("dialog", { name: "מקרא" }).waitFor();
        await shoot(page, "07-gantt-timeline-legend");
    });

    test("gantt grid context menu", async ({ page }) => {
        await open(page, "/gantt");
        await waitForAppLoad(page);
        await page.getByRole("tab", { name: "טבלה" }).click();
        const firstCell = page.getByRole("grid", { name: "טבלת גאנט" }).locator("tbody td").first();
        await firstCell.waitFor({ timeout: 30_000 });
        await firstCell.click({ button: "right" });
        await page.getByRole("menu").waitFor();
        await shoot(page, "04-gantt-grid-menu");
    });

    // #899: the course picker inside the table's scheduled-hours cell. The demo
    // assigns nothing per course (one kind of student, so no picker): stage two.
    test("gantt hours per course", async ({ page, request }) => {
        const fixture = await createHoursCourseFixture(request, "shot-hours-course");
        try {
            await open(page, `/gantt?gc=${ fixture.curriculumId }`);
            await waitForAppLoad(page);
            await page.getByRole("tab", { name: "טבלה" }).click();
            await page.getByRole("combobox", { name: "קורס לחישוב השעות" }).click({ timeout: 30_000 });
            await page.getByRole("listbox").waitFor();
            await shoot(page, "08-gantt-hours-course");
        } finally {
            await deleteCourses(request, fixture.courses);
        }
    });

    test("schedule in pink mode", async ({ page }) => {
        // next-themes reads its choice from localStorage before first paint (#765).
        await page.addInitScript(() => localStorage.setItem("theme", "pink"));
        await open(page, "/");
        await waitForAppLoad(page);
        await shoot(page, "05-schedule-pink");
    });

    test("schedule in pink dark mode", async ({ page }) => {
        await page.addInitScript(() => localStorage.setItem("theme", "pink-dark"));
        await open(page, "/");
        await waitForAppLoad(page);
        await shoot(page, "09-schedule-pink-dark");
    });
});