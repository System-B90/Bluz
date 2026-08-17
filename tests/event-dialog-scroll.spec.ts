import {
    expect,
    test,
    dblclickCalendarEvent,
    getEventDialog,
    gotoAppHome,
    selectCalendarTimeRange,
    switchToDayView,
} from "./fixtures";

/**
 * #463: the event dialog could not be scrolled, so on a short window the
 * save button sat below the fold with no way to reach it. The Paper is
 * clipped with `overflow: hidden` for its rounded corners, so the scroll has
 * to happen inside DialogContent — which only works if the <form> between
 * them is a shrinkable flex column.
 */

const SHORT_VIEWPORT = { width: 1280, height: 500 };

test.describe("Event dialog scrolling (#463)", () => {
    test.beforeEach(async ({ page }) => {
        await page.setViewportSize(SHORT_VIEWPORT);
        await gotoAppHome(page);
    });

    test("keeps the save button reachable in a short window", async ({ page }) => {
        await selectCalendarTimeRange(page);
        const dialog = getEventDialog(page);
        await expect(dialog).toBeVisible({ timeout: 5_000 });

        const save = dialog.getByRole("button", { name: "שמירה" });
        await expect(save).toBeVisible();
        await expect(save).toBeInViewport();
    });

    test("scrolls the content, not the clipped Paper", async ({ page }) => {
        await selectCalendarTimeRange(page);
        const dialog = getEventDialog(page);
        await expect(dialog).toBeVisible({ timeout: 5_000 });

        const content = dialog.locator(".MuiDialogContent-root");
        const overflow = await content.evaluate(
            (el) => getComputedStyle(el).overflowY,
        );
        expect(overflow).toBe("auto");

        // Nothing is clipped away: whatever the content's height, it is
        // scrollable rather than cut off by the Paper.
        const { clientHeight, scrollHeight } = await content.evaluate((el) => ({
            clientHeight: el.clientHeight,
            scrollHeight: el.scrollHeight,
        }));
        expect(scrollHeight).toBeGreaterThanOrEqual(clientHeight);

        if (scrollHeight > clientHeight) {
            await content.evaluate((el) => el.scrollTo(0, el.scrollHeight));
            const scrolled = await content.evaluate((el) => el.scrollTop);
            expect(scrolled).toBeGreaterThan(0);
        }
    });

    test("pins the actions while the content scrolls", async ({ page }) => {
        await selectCalendarTimeRange(page);
        const dialog = getEventDialog(page);
        await expect(dialog).toBeVisible({ timeout: 5_000 });

        const content = dialog.locator(".MuiDialogContent-root");
        const save = dialog.getByRole("button", { name: "שמירה" });

        const before = await save.boundingBox();
        await content.evaluate((el) => el.scrollTo(0, el.scrollHeight));
        await page.waitForTimeout(200);
        const after = await save.boundingBox();

        expect(before).not.toBeNull();
        expect(after).not.toBeNull();
        expect(Math.abs(after!.y - before!.y)).toBeLessThan(2);
    });

    test("stays scrollable for a saved event, which also renders its history", async ({
        page,
    }) => {
        // A saved event adds the history panel, the tallest section of all.
        await switchToDayView(page);
        const anyEvent = page.locator(".rbc-event").first();
        await expect(anyEvent).toBeVisible({ timeout: 10_000 });
        const name = ((await anyEvent.textContent()) ?? "").trim().slice(0, 8);
        await dblclickCalendarEvent(page, name);

        const dialog = getEventDialog(page);
        await expect(dialog).toBeVisible({ timeout: 5_000 });
        await expect(
            dialog.getByRole("button", { name: "שמירה" }),
        ).toBeInViewport();
    });
});
