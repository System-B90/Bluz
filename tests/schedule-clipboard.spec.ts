import type { Page } from "@playwright/test";

import {
    expect,
    getEventDialog,
    gotoAppHome,
    selectCalendarTimeRange,
    switchToDayView,
    test,
    testId,
} from "./fixtures";

/**
 * #859: the tile menu leads with Cut / Copy / Paste, and right-clicking empty
 * grid offers Paste at that slot.
 */
test.describe("Schedule right-click clipboard", () => {
    test.describe.configure({ timeout: 120_000 });

    test("copy from the tile menu, paste from an empty-slot menu, then cut", async ({ page }) => {
        const eventName = `לוח ${testId("clip")}`;

        await gotoAppHome(page);
        await switchToDayView(page);
        await selectCalendarTimeRange(page);
        const dialog = getEventDialog(page);
        await expect(dialog).toBeVisible({ timeout: 30_000 });
        await dialog.getByLabel("שם").fill(eventName);
        await dialog.getByRole("button", { name: "שמירה" }).click();
        await expect(dialog).not.toBeVisible({ timeout: 30_000 });

        const tiles = page.getByText(eventName);
        await expect(tiles.first()).toBeVisible({ timeout: 30_000 });

        // Clipboard section sits at the top of the menu, in desktop order.
        await tiles.first().click({ button: "right" });
        const items = page.getByRole("menuitem");
        await expect(items.nth(0)).toContainText("גזירה");
        await expect(items.nth(1)).toContainText("העתקה");
        await expect(items.nth(2)).toContainText("הדבקה");
        await expect(items.nth(2)).toHaveAttribute("aria-disabled", "true");
        await items.nth(1).click();
        await expect(page.getByRole("menu")).toHaveCount(0);

        // Right-click on empty grid, well below the event and clear of the
        // toast stack on the right: paste lands there.
        const box = (await tiles.first().boundingBox())!;
        await page.mouse.click(300, box.y + box.height + 150, { button: "right" });
        const paste = page.getByRole("menuitem", { name: /הדבקה/ });
        await expect(paste).toBeEnabled();
        await paste.click();
        await expect(tiles).toHaveCount(2, { timeout: 15_000 });
        await expect(page.getByRole("menu")).toHaveCount(0);

        // Cut removes the copy it was used on.
        await tiles.last().click({ button: "right" });
        await page.getByRole("menuitem", { name: /גזירה/ }).click();
        await expect(tiles).toHaveCount(1, { timeout: 15_000 });
        await expect(page.getByRole("menu")).toHaveCount(0);

        // Clean up the original.
        await tiles.first().click({ button: "right" });
        await page.getByRole("menuitem", { name: "מחיקה" }).click();
        await expect(tiles).toHaveCount(0, { timeout: 15_000 });
    });

    test("a past iteration opens the menu with Copy only, and its copy pastes into the current one", async ({
        page,
        request,
    }) => {
        const tempId = `e2e-clip-${Date.now()}`;
        const tempLabel = `מחזור העתקה ${tempId}`;
        const eventName = `העתקה ממחזור ${tempId}`;
        const iterations = (await (await request.get("/api/iterations")).json()).data;
        const original = iterations.find((it: { isCurrent: boolean }) => it.isCurrent);
        expect(original, "an iteration must be current to start").toBeTruthy();
        const originalLabel: string = original.label ?? original.id;

        const created = await request.post("/api/iterations", {
            data: {
                id: tempId,
                label: tempLabel,
                hiveCache: { modules: {}, subjects: {}, rooms: {}, cachedAt: new Date().toISOString() },
            },
        });
        expect(created.ok()).toBeTruthy();
        const eventId = crypto.randomUUID();
        const start = new Date();
        start.setHours(10, 0, 0, 0);

        try {
            // Seed the event while temp is current, then make it a past run.
            await request.patch(`/api/iterations/${tempId}`, { data: { isCurrent: true } });
            const put = await request.put("/api/event", {
                data: {
                    courses: [], endTime: new Date(start.getTime() + 3_600_000).toISOString(), hidden: false,
                    hiveLesson: null, hiveModule: null, hiveQueues: {}, id: eventId, instructors: [],
                    lecturers: [], locked: false, name: eventName, notes: "", personalTalk: false,
                    required: false, rooms: [], splitAcrossBreaks: false, startTime: start.toISOString(),
                    subject: null, tags: [], type: 'ע"ע',
                },
            });
            expect(put.ok(), "seeding the past-iteration event failed").toBeTruthy();
            await request.patch(`/api/iterations/${original.id}`, { data: { isCurrent: true } });

            await gotoAppHome(page);
            await switchToDayView(page);
            await pickIteration(page, tempLabel);
            await expect(page.getByText("קריאה בלבד")).toBeVisible();

            const tile = page.getByText(eventName).first();
            await expect(tile).toBeVisible({ timeout: 30_000 });
            await tile.click({ button: "right" });
            await expect(page.getByRole("menuitem", { name: /העתקה/ })).toBeEnabled();
            for (const name of [ /גזירה/, /הדבקה/, /^מחיקה$/, /דחייה בשבוע/, /שכפול/ ]) {
                await expect(page.getByRole("menuitem", { name })).toHaveAttribute("aria-disabled", "true");
            }
            await page.getByRole("menuitem", { name: /העתקה/ }).click();
            await expect(page.getByRole("menu")).toHaveCount(0);

            // Paste is disabled on empty grid of the past run too.
            await rightClickSlot(page, 14);
            await expect(page.getByRole("menuitem", { name: /הדבקה/ })).toHaveAttribute("aria-disabled", "true");
            await page.keyboard.press("Escape");

            // Back on the current run, the clipboard survives and pastes.
            await pickIteration(page, `${originalLabel} (נוכחי)`);
            await expect(page.getByText("קריאה בלבד")).toHaveCount(0);
            await rightClickSlot(page, 14);
            await page.getByRole("menuitem", { name: /הדבקה/ }).click();
            const pasted = page.getByText(eventName);
            await expect(pasted).toHaveCount(1, { timeout: 15_000 });

            await pasted.first().click({ button: "right" });
            await page.getByRole("menuitem", { name: /^מחיקה$/ }).click();
            await expect(pasted).toHaveCount(0, { timeout: 15_000 });
        } finally {
            await request.patch(`/api/iterations/${tempId}`, { data: { isCurrent: true } });
            await request.delete("/api/event", { data: JSON.stringify(eventId) }).catch(() => {});
            await request.patch(`/api/iterations/${original.id}`, { data: { isCurrent: true } });
            await request.delete(`/api/iterations/${tempId}`).catch(() => {});
        }
    });
});

async function pickIteration(page: Page, label: string) {
    await page.getByRole("combobox").filter({ hasText: /מחזור|נוכחי|\(/ }).first().click();
    await page.getByRole("option", { name: label }).click();
}

/** Right-clicks today's first room column at `hour`:00, clear of the event overlay. */
async function rightClickSlot(page: Page, hour: number) {
    const at = new Date();
    at.setHours(hour, 0, 0, 0);
    const slot = page.locator(`.rbc-day-slot [data-slot-start="${at.getTime()}"]`).first();
    const box = (await slot.boundingBox())!;
    await page.mouse.click(box.x + 20, box.y + box.height / 2, { button: "right" });
}