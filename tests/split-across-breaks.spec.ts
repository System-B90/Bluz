import { APIRequestContext, Page } from "@playwright/test";

import
    {
        expect,
        getEventDialog,
        gotoAppHome,
        SELECTORS,
        switchToDayView,
        test,
        testId,
    } from "./fixtures";

/**
 * Split-across-breaks (#event.splitAcrossBreaks): an event that spans a break
 * (e.g. a lunch break) draws as two calendar segments with a cut at the break
 * boundary, instead of one continuous block covering the break.
 *
 * A freshly drag-created event starts with `splitAcrossBreaks` off
 * regardless of type — `defaultSplitAcrossBreaks` (api-shared/types/event.ts)
 * only kicks in when the type field's own onChange fires, not on initial
 * creation — so this suite toggles the "פיצול סביב הפסקות" chip explicitly rather
 * than relying on a default.
 */

/** Opens a fresh event dialog by dragging an arbitrary slot in day view. */
async function openNewEventDialog(page: Page): Promise<void> {
    await switchToDayView(page);

    await page.evaluate(() => {
        document.querySelectorAll(".rbc-events-container").forEach((el) => {
            (el as HTMLElement).style.pointerEvents = "none";
        });
    });

    const daySlot = page.locator(".rbc-time-content .rbc-day-slot").first();
    await daySlot.scrollIntoViewIfNeeded();
    const box = await daySlot.boundingBox();
    if (!box) throw new Error("Calendar day slot not found");

    const x = box.x + box.width / 2;
    await page.mouse.move(x, box.y + box.height * 0.5);
    await page.mouse.down();
    await page.mouse.move(x, box.y + box.height * 0.55, { steps: 4 });
    await page.mouse.up();
    await page.waitForTimeout(300);

    await page.evaluate(() => {
        document.querySelectorAll(".rbc-events-container").forEach((el) => {
            (el as HTMLElement).style.pointerEvents = "";
        });
    });
}

/**
 * Sets a MUI X sectioned time field to an exact HH:mm. Clicking the field
 * focuses its first (hour) section; typing two digits fills it and
 * auto-advances to the minute section, where the same applies.
 */
async function setTimeField(
    page: Page,
    fieldGroup: ReturnType<Page["getByRole"]>,
    hh: string,
    mm: string,
): Promise<void> {
    await fieldGroup.click();
    await page.keyboard.type(hh, { delay: 50 });
    await page.keyboard.type(mm, { delay: 50 });
}

/**
 * Deletes every event named `name` via the API. Deleting through the UI
 * requires double-clicking the exact calendar tile, which is unreliable here:
 * a split event draws as multiple overlapping-in-time segments (by design —
 * that's the feature under test), so a tile located by name alone isn't
 * guaranteed to be the real thing under the click point.
 */
async function deleteEventsByName(
    request: APIRequestContext,
    name: string,
): Promise<void> {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);

    const response = await request.get(
        `/api/event?sd=${start.toISOString()}&ed=${end.toISOString()}`,
    );
    if (!response.ok()) return;
    const { data: events }: { data: Array<{ id: string; name: string }> } =
        await response.json();

    for (const event of events.filter((e) => e.name === name)) {
        await request.delete("/api/event", { data: JSON.stringify(event.id) });
    }
}

test.describe("Split across breaks", () => {
    test.describe.configure({ timeout: 60_000 });

    test.beforeEach(async ({ page }) => {
        await gotoAppHome(page);
    });

    test("an exercise spanning a break draws as two segments", async ({
        page,
        request,
    }) => {
        const breakName = testId("break");
        const exerciseName = testId("exercise");

        // 1) A short break window from 12:00 to 12:15.
        await openNewEventDialog(page);
        let dialog = getEventDialog(page);
        await expect(dialog).toBeVisible();
        await dialog.locator("input").first().fill(breakName);

        await setTimeField(
            page,
            dialog.getByRole("group", { name: "שעת התחלה" }),
            "12",
            "00",
        );
        await setTimeField(
            page,
            dialog.getByRole("group", { name: "שעת סיום" }),
            "12",
            "15",
        );

        await dialog
            .locator(".MuiFormControl-root")
            .filter({ hasText: "סוג" })
            .getByRole("combobox")
            .click();
        await page.getByRole("option", { name: "הפסקה", exact: true }).click();

        await dialog.getByRole("button", { name: "שמירה" }).click();
        await expect(dialog).toBeHidden();

        // Reload so the new break is part of the calendar's loaded event set
        // before the split-aware event below is created — otherwise the
        // client-side break-window collection used for layout may still
        // reflect pre-creation state.
        await gotoAppHome(page);

        try {
            // 2) An exercise straddling the break with plenty of margin on
            // both sides: 09:00–16:00. Both resulting pieces need to clear
            // `UnifiedEvent`'s CONTINUATION_LABEL_MIN_HEIGHT (34px) or the
            // second piece renders without its name text, which would make
            // a name-based tile count look like the split didn't happen.
            await openNewEventDialog(page);
            dialog = getEventDialog(page);
            await expect(dialog).toBeVisible();
            await dialog.locator("input").first().fill(exerciseName);

            await setTimeField(
                page,
                dialog.getByRole("group", { name: "שעת התחלה" }),
                "09",
                "00",
            );
            await setTimeField(
                page,
                dialog.getByRole("group", { name: "שעת סיום" }),
                "16",
                "00",
            );

            // A freshly drag-created event starts with the toggle off
            // regardless of type — switch it on explicitly.
            await dialog
                .getByRole("switch", { name: "פיצול סביב הפסקות" })
                .click();
            await expect(
                dialog.getByRole("switch", { name: "פיצול סביב הפסקות" }),
            ).toHaveAttribute("aria-checked", "true");

            await dialog.getByRole("button", { name: "שמירה" }).click();
            await expect(dialog).toBeHidden();

            // The event spans the break, so it draws as (at least) two
            // pieces sharing the same event name.
            const segments = page
                .locator(SELECTORS.calendarEvent)
                .filter({ hasText: exerciseName });
            await expect(segments).toHaveCount(2, { timeout: 10_000 });
        } finally {
            await deleteEventsByName(request, breakName);
            await deleteEventsByName(request, exerciseName);
        }
    });

    test("toggling off split-across-breaks keeps the event as one piece", async ({
        page,
        request,
    }) => {
        const breakName = testId("break2");
        const exerciseName = testId("exercise-nosplit");

        await openNewEventDialog(page);
        let dialog = getEventDialog(page);
        await expect(dialog).toBeVisible();
        await dialog.locator("input").first().fill(breakName);
        await setTimeField(
            page,
            dialog.getByRole("group", { name: "שעת התחלה" }),
            "13",
            "00",
        );
        await setTimeField(
            page,
            dialog.getByRole("group", { name: "שעת סיום" }),
            "13",
            "30",
        );
        await dialog
            .locator(".MuiFormControl-root")
            .filter({ hasText: "סוג" })
            .getByRole("combobox")
            .click();
        await page.getByRole("option", { name: "הפסקה", exact: true }).click();
        await dialog.getByRole("button", { name: "שמירה" }).click();
        await expect(dialog).toBeHidden();

        try {
            await openNewEventDialog(page);
            dialog = getEventDialog(page);
            await expect(dialog).toBeVisible();
            await dialog.locator("input").first().fill(exerciseName);
            await setTimeField(
                page,
                dialog.getByRole("group", { name: "שעת התחלה" }),
                "12",
                "45",
            );
            await setTimeField(
                page,
                dialog.getByRole("group", { name: "שעת סיום" }),
                "13",
                "45",
            );

            // A freshly drag-created event starts with the toggle off.
            await expect(
                dialog.getByRole("switch", { name: "פיצול סביב הפסקות" }),
            ).toHaveAttribute("aria-checked", "false");

            await dialog.getByRole("button", { name: "שמירה" }).click();
            await expect(dialog).toBeHidden();

            const segments = page
                .locator(SELECTORS.calendarEvent)
                .filter({ hasText: exerciseName });
            await expect(segments).toHaveCount(1, { timeout: 10_000 });
        } finally {
            await deleteEventsByName(request, breakName);
            await deleteEventsByName(request, exerciseName);
        }
    });
});
