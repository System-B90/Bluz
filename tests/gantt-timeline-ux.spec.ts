import { Page } from "@playwright/test";

import { expect, expectNoOpenModal, test, waitForAppLoad } from "./fixtures";
import {
    addWeeks,
    createAndSelectCurriculum,
    createModuleWithEvents,
    getTimelineEventRow,
} from "./gantt-timeline-helpers";

/**
 * רצף זמן timeline UX review fixes (#808-#833): keyboard expand, keyboard
 * scheduling with a visible target, the drop snackbar and its undo, Enter
 * to open a bar, the unscheduled-module chip and the unallocated panel.
 *
 * Each test builds its own curriculum (one syllabus, one module with the two
 * default events), so state starts empty and deterministic.
 */

async function openFreshTimeline(page: Page): Promise<string> {
    const eventTitle = await createModuleWithEvents(page);
    // createModuleWithEvents leaves the new module's dialog open.
    await page.keyboard.press("Escape");
    await expectNoOpenModal(page, 10_000);
    await page.getByRole("tab", { name: "רצף זמן" }).click();
    return eventTitle;
}

function userModuleRow(page: Page) {
    return page.locator('[id^="gantt-row-module-"]').filter({ hasNotText: "הפסקות" });
}

test.describe("Gantt timeline UX (#808-#833)", () => {
    test.describe.configure({ timeout: 90_000 });

    test.beforeEach(async ({ page }) => {
        await page.goto("/gantt");
        await waitForAppLoad(page);
        await createAndSelectCurriculum(page);
        await addWeeks(page, 1);
    });

    test("an unscheduled module keeps its name and shows a distinct chip (#817)", async ({ page }) => {
        await openFreshTimeline(page);

        const row = userModuleRow(page);
        await expect(row).toBeVisible({ timeout: 10_000 });
        await expect(row.getByRole("button", { name: /לא משובץ — גרור לציר/ })).toBeVisible();
        await expect(row.locator("td").first()).toContainText("לא משובץ");
    });

    test("the row toggle works from the keyboard and reports its state (#816)", async ({ page }) => {
        const eventTitle = await openFreshTimeline(page);

        const toggle = userModuleRow(page).getByRole("button", { name: /^הרחבת / });
        await expect(toggle).toHaveAttribute("aria-expanded", "false", { timeout: 10_000 });
        await toggle.focus();
        await page.keyboard.press("Enter");

        await expect(userModuleRow(page).getByRole("button", { name: /^כיווץ / }))
            .toHaveAttribute("aria-expanded", "true");
        await expect(page.locator('[id^="gantt-row-event-"]').filter({ hasText: eventTitle }))
            .toBeVisible();
    });

    test("an event is scheduled with the keyboard, confirmed, and undone with Ctrl+Z (#808, #809, #810, #811)", async ({ page }) => {
        const eventTitle = await openFreshTimeline(page);
        const eventRow = await getTimelineEventRow(page, eventTitle);
        const staged = eventRow.locator('td:first-child [id^="block-event-"]');
        await expect(staged).toBeVisible({ timeout: 10_000 });

        await staged.focus();
        await page.keyboard.press("Space");
        await page.keyboard.press("ArrowLeft");

        // The hovered cell is visibly outlined while the bar is held (#811).
        await expect.poll(async () => eventRow.locator("td").evaluateAll(
            (cells) => cells.some((c) => getComputedStyle(c).boxShadow.includes("inset")),
        ), { timeout: 5_000 }).toBe(true);

        await page.keyboard.press("Space");

        await expect(page.getByText(/שובץ ליום/)).toBeVisible({ timeout: 10_000 });
        await expect(eventRow.locator('td:not(:first-child) [id^="block-event-"]')).toBeVisible();

        // Layout-independent undo: matched by the physical Z key.
        await page.locator("body").click({ position: { x: 5, y: 5 } });
        await page.keyboard.press("Control+KeyZ");

        await expect(page.getByText(/^בוטל:/)).toBeVisible({ timeout: 10_000 });
        await expect(eventRow.locator('td:first-child [id^="block-event-"]')).toBeVisible({ timeout: 10_000 });
    });

    test("Enter opens a scheduled bar (#833)", async ({ page }) => {
        const eventTitle = await openFreshTimeline(page);
        const eventRow = await getTimelineEventRow(page, eventTitle);
        const staged = eventRow.locator('td:first-child [id^="block-event-"]');
        await expect(staged).toBeVisible({ timeout: 10_000 });
        await staged.focus();
        await page.keyboard.press("Space");
        await page.keyboard.press("ArrowLeft");
        await page.keyboard.press("Space");

        const bar = eventRow.locator('td:not(:first-child) [id^="block-event-"]');
        await expect(bar).toBeVisible({ timeout: 10_000 });
        await bar.focus();
        await page.keyboard.press("Enter");

        await expect(page.getByRole("dialog")).toBeVisible({ timeout: 10_000 });
    });

    test("the unallocated panel separates modules from events (#818)", async ({ page }) => {
        await openFreshTimeline(page);

        await page.getByRole("button", { name: /פערי שיבוץ|לא משובצים/ }).first().click();

        await expect(page.getByText("מערכים", { exact: true }).first()).toBeVisible({ timeout: 10_000 });
        await expect(page.getByText("מופעים", { exact: true }).first()).toBeVisible();
        await expect(page.locator('[data-unallocated-chip="event"]').first()).toBeVisible();
    });
});
