import { APIRequestContext, Page } from "@playwright/test";

import {
    expect,
    test,
    SELECTORS,
    getEventDialog,
    gotoAppHome,
    switchToDayView,
    testId,
} from "./fixtures";

/**
 * Instructor rail drag-and-drop (ui/src/components/schedule/calendar/instructor-dnd).
 * Covers: opening the rail, dragging an instructor chip onto an event to
 * assign it, dragging an assigned chip onto the "unassign" drop zone, and the
 * "already assigned" guard.
 */

/** Opens the collapsible instructor rail via its toggle IconButton. */
async function openInstructorRail(page: Page): Promise<void> {
    const toggle = page.getByRole("button", { name: "פתיחת רשימת מבוזרים" });
    if (await toggle.isVisible().catch(() => false)) {
        await toggle.click();
        await page.waitForTimeout(400);
    }
}

/** First draggable instructor chip currently rendered in the open rail. */
function firstRailChip(page: Page) {
    // InstructorRailChip is the only element in the tree that sets a native
    // `title` HTML attribute (the rail item's tooltip), so this selector is
    // unambiguous even though nothing carries a test id.
    return page.locator("[title]").first();
}

/** A slow, multi-step mouse drag — dnd-kit's PointerSensor needs real
 * intermediate pointermove events (past its 6px activation distance) to
 * arm the drag and to compute the live drop target. */
async function dragBetween(
    page: Page,
    from: { x: number; y: number },
    to: { x: number; y: number },
): Promise<void> {
    // Snackbars render bottom-corner and can linger long enough to overlap a
    // drag's start/end point, silently turning the drag into a text
    // selection instead. Let any pending toast clear first.
    await page
        .locator(SELECTORS.snackbar)
        .waitFor({ state: "hidden", timeout: 6_000 })
        .catch(() => undefined);

    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(
        from.x + (to.x - from.x) / 2,
        from.y + (to.y - from.y) / 2,
        { steps: 5 },
    );
    await page.mouse.move(to.x, to.y, { steps: 8 });
    await page.waitForTimeout(150);
    await page.mouse.up();
    await page.waitForTimeout(400);
}

/** Fetches the freshly-created event's current `instructors` array via the API. */
async function getEventInstructors(
    request: APIRequestContext,
    name: string,
): Promise<Array<number>> {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);

    const response = await request.get(
        `/api/event?sd=${start.toISOString()}&ed=${end.toISOString()}`,
    );
    if (!response.ok()) return [];
    const { data: events }: {
        data: Array<{ id: string; name: string; instructors?: Array<number> }>;
    } = await response.json();
    const match = events.find((e) => e.name === name);
    return match?.instructors ?? [];
}

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

/**
 * Drag-selects a slot around the middle of the visible day column (~0.55)
 * instead of fixtures' default 0.25-0.32 fraction. Every other spec's
 * drag-select helper uses that default fraction on "today", which packs many
 * overlapping leftover/demo events into the same few pixels — react-big-
 * calendar then squeezes each tile down to a sliver just a few px wide,
 * which makes a mouse drag onto *this* test's own tile unreliable. A
 * distinct, normally quiet slot sidesteps that collision. (A late-evening
 * fraction was tried first and rejected: it lands exactly under where the
 * notistack toast stack renders, so pointer-downs meant for the event tile
 * hit the toast text instead.)
 */
async function selectQuietTimeRange(page: Page): Promise<void> {
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
    const startY = box.y + box.height * 0.55;
    const endY = box.y + box.height * 0.6;

    await page.mouse.move(x, startY);
    await page.mouse.down();
    await page.mouse.move(x, endY, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(500);

    await page.evaluate(() => {
        document.querySelectorAll(".rbc-events-container").forEach((el) => {
            (el as HTMLElement).style.pointerEvents = "";
        });
    });
}

/** Creates a named event via drag-select + the event dialog, returns its name. */
async function createEvent(page: Page): Promise<string> {
    const name = testId("instr-dnd");
    await selectQuietTimeRange(page);

    const dialog = getEventDialog(page);
    await expect(dialog).toBeVisible();
    await dialog.locator("input").first().fill(name);
    await dialog.getByRole("button", { name: "שמירה" }).click();
    await page.waitForTimeout(500);

    await expect(
        page.locator(SELECTORS.calendarEvent).filter({ hasText: name }),
    ).toBeVisible({ timeout: 5_000 });

    return name;
}

test.describe("Instructor rail drag-and-drop", () => {
    test.describe.configure({ timeout: 60_000 });

    test.beforeEach(async ({ page }) => {
        await gotoAppHome(page);
    });

    test.afterEach(async ({ request }, testInfo) => {
        const name = testInfo.annotations.find((a) => a.type === "event-name")?.description;
        if (name) await deleteEventsByName(request, name);
    });

    test("rail toggle opens and closes", async ({ page }) => {
        const openButton = page.getByRole("button", { name: "פתיחת רשימת מבוזרים" });
        await expect(openButton).toBeVisible();
        await openButton.click();
        await page.waitForTimeout(400);

        const closeButton = page.getByRole("button", { name: "סגירת רשימת מבוזרים" });
        await expect(closeButton).toBeVisible();
        await closeButton.click();
        await page.waitForTimeout(400);

        await expect(
            page.getByRole("button", { name: "פתיחת רשימת מבוזרים" }),
        ).toBeVisible();
    });

    test("dragging an instructor chip onto an event assigns them", async ({
        page,
        request,
    }, testInfo) => {
        const name = await createEvent(page);
        testInfo.annotations.push({ type: "event-name", description: name });

        await openInstructorRail(page);

        const chip = firstRailChip(page);
        await expect(chip).toBeVisible({ timeout: 10_000 });
        const chipBox = await chip.boundingBox();

        const eventTile = page
            .locator(SELECTORS.calendarEvent)
            .filter({ hasText: name })
            .first();
        await expect(eventTile).toBeVisible();
        const eventBox = await eventTile.boundingBox();

        if (!chipBox || !eventBox) throw new Error("Missing bounding box");

        expect(await getEventInstructors(request, name)).toHaveLength(0);

        await dragBetween(
            page,
            { x: chipBox.x + chipBox.width / 2, y: chipBox.y + chipBox.height / 2 },
            { x: eventBox.x + eventBox.width / 2, y: eventBox.y + eventBox.height / 2 },
        );

        await expect
            .poll(async () => (await getEventInstructors(request, name)).length, {
                timeout: 10_000,
            })
            .toBe(1);
    });

    test("dragging an assigned chip out of an event to the unassign zone removes them", async ({
        page,
        request,
    }, testInfo) => {
        const name = await createEvent(page);
        testInfo.annotations.push({ type: "event-name", description: name });

        await openInstructorRail(page);

        const chip = firstRailChip(page);
        await expect(chip).toBeVisible({ timeout: 10_000 });
        const chipBox = await chip.boundingBox();

        const eventTile = page
            .locator(SELECTORS.calendarEvent)
            .filter({ hasText: name })
            .first();
        const eventBox = await eventTile.boundingBox();
        if (!chipBox || !eventBox) throw new Error("Missing bounding box");

        await dragBetween(
            page,
            { x: chipBox.x + chipBox.width / 2, y: chipBox.y + chipBox.height / 2 },
            { x: eventBox.x + eventBox.width / 2, y: eventBox.y + eventBox.height / 2 },
        );

        await expect
            .poll(async () => (await getEventInstructors(request, name)).length, {
                timeout: 10_000,
            })
            .toBe(1);

        // The assigned person renders as a PersonChip: an outer <span> Box
        // carrying the dnd-kit drag listeners, wrapping either plain text (an
        // outsider) or a button-Link that toggles the instructor filter. The
        // chip used to be an <a href="a"> and the test matched that literal
        // href — #470 turned it into component="button", so that locator went
        // dead (#590). Match the outer span by test id instead: that is where
        // the drag listeners live, so pointer-down lands in the right place.
        const personChip = eventTile
            .getByTestId("event-person-chip")
            .first();
        await expect(personChip).toBeVisible();
        const personBox = await personChip.boundingBox();

        const unassignZone = page.getByText("הסרה");
        await expect(unassignZone).toBeVisible();
        const unassignBox = await unassignZone.boundingBox();
        if (!personBox || !unassignBox) throw new Error("Missing bounding box");

        await dragBetween(
            page,
            { x: personBox.x + personBox.width / 2, y: personBox.y + personBox.height / 2 },
            { x: unassignBox.x + unassignBox.width / 2, y: unassignBox.y + unassignBox.height / 2 },
        );

        await expect
            .poll(async () => (await getEventInstructors(request, name)).length, {
                timeout: 10_000,
            })
            .toBe(0);
    });

    test("dragging the same instructor onto an event twice shows an already-assigned notice", async ({
        page,
        request,
    }, testInfo) => {
        const name = await createEvent(page);
        testInfo.annotations.push({ type: "event-name", description: name });

        await openInstructorRail(page);

        const chip = firstRailChip(page);
        await expect(chip).toBeVisible({ timeout: 10_000 });
        const chipBox = await chip.boundingBox();

        const eventTile = page
            .locator(SELECTORS.calendarEvent)
            .filter({ hasText: name })
            .first();
        const eventBox = await eventTile.boundingBox();
        if (!chipBox || !eventBox) throw new Error("Missing bounding box");

        const target = {
            x: eventBox.x + eventBox.width / 2,
            y: eventBox.y + eventBox.height / 2,
        };

        await dragBetween(
            page,
            { x: chipBox.x + chipBox.width / 2, y: chipBox.y + chipBox.height / 2 },
            target,
        );
        await expect
            .poll(async () => (await getEventInstructors(request, name)).length, {
                timeout: 10_000,
            })
            .toBe(1);

        // Re-open the rail (defensive — it should still be open) and drag the
        // same first chip again onto the same event.
        await openInstructorRail(page);
        const chipAgain = firstRailChip(page);
        const chipAgainBox = await chipAgain.boundingBox();
        if (!chipAgainBox) throw new Error("Missing bounding box");

        await dragBetween(
            page,
            { x: chipAgainBox.x + chipAgainBox.width / 2, y: chipAgainBox.y + chipAgainBox.height / 2 },
            target,
        );

        await expect(page.locator(SELECTORS.snackbar)).toContainText("כבר משובץ לאירוע זה", {
            timeout: 5_000,
        });

        // Still only one instructor — the duplicate drop was a no-op.
        expect(await getEventInstructors(request, name)).toHaveLength(1);
    });
});
