import { Locator, Page } from "@playwright/test";

import {
    closeEventAndModuleDialogs,
    expect,
    openEventEditDialog,
    test,
    waitForAppLoad,
} from "./fixtures";
import {
    addWeeks,
    createAndSelectCurriculum,
    createModuleWithEvents,
    dragBlockWithinItsCell,
    getTimelineEventRow,
} from "./gantt-timeline-helpers";

/**
 * Gantt timeline recurring-event integration tests (#111).
 *
 * Covers: setting an event's recurrence, mapping it to the first week (which
 * satisfies a weekly recurrence — an occurrence exists in every week), and the
 * resulting repeat blocks/unallocated marker in the timeline (רצף זמן) tab.
 *
 * Each test creates its own curriculum so the timeline/hierarchy state starts
 * empty and deterministic.
 */


/** Opens the event dialog for `eventTitle` and sets its recurrence. */
async function setEventRecurrence(
    page: Page,
    eventTitle: string,
    recurrenceLabel: "יומי" | "שבועי",
): Promise<void> {
    const eventDialog = await openEventEditDialog(page, eventTitle);

    // The recurrence field lives in a collapsed "שיבוץ ודרישות" accordion.
    await eventDialog.getByText("שיבוץ ודרישות").click();

    const recurrenceSelect = eventDialog
        .getByRole("combobox", { name: "חזרה" });
    await expect(recurrenceSelect).toBeVisible({ timeout: 5_000 });
    await recurrenceSelect.click();

    await page.getByRole("option", { name: recurrenceLabel }).click();
    await expect(recurrenceSelect).toHaveText(recurrenceLabel);

    await closeEventAndModuleDialogs(page, eventDialog);
}


/** Drags `block` onto the row's first (label/remove) column, to trigger a remove drop. */
async function dragBlockToRemoveColumn(
    page: Page,
    block: Locator,
    row: Locator,
): Promise<void> {
    const blockBox = await block.boundingBox();
    const cellBox = await row.locator("td").first().boundingBox();
    if (!blockBox || !cellBox) throw new Error("Block or remove cell not found for drag");

    await page.mouse.move(
        blockBox.x + blockBox.width / 2,
        blockBox.y + blockBox.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(
        cellBox.x + cellBox.width / 2,
        cellBox.y + cellBox.height / 2,
        { steps: 10 },
    );
    await page.mouse.up();
    await page.waitForTimeout(500);
}


/**
 * Maps `eventTitle`'s recurring event to the first week/day, satisfying its
 * recurrence.
 *
 * The nudge is the gesture that works here: it drops the block on the day it
 * already sits over, which is what the recurrence assertions expect. Dropping
 * on the week cell's *centre* instead lands on a mid-week day and breaks every
 * echo count in this file — do not "simplify" this into `mapEventToWeek`.
 */
async function mapEventToFirstWeek(page: Page, eventRow: Locator): Promise<void> {
    const stagedBlock = eventRow.locator('[id^="block-event-"]');
    await expect(stagedBlock).toBeVisible({ timeout: 10_000 });
    await dragBlockWithinItsCell(page, stagedBlock);
}

/** Drags an unmapped event's staged block onto `weekIndex`'s cell in the row (weekly view). */
async function mapEventToWeek(
    page: Page,
    eventRow: Locator,
    weekIndex: number,
): Promise<void> {
    const stagedBlock = eventRow.locator('[id^="block-event-"]');
    await expect(stagedBlock).toBeVisible({ timeout: 10_000 });
    const blockBox = await stagedBlock.boundingBox();
    // Column 0 is the sticky label cell; week columns follow in order.
    const targetCell = eventRow.locator("td").nth(weekIndex + 1);
    const cellBox = await targetCell.boundingBox();
    if (!blockBox || !cellBox) throw new Error("Block or week cell not found for drag");

    await page.mouse.move(blockBox.x + blockBox.width / 2, blockBox.y + blockBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(cellBox.x + cellBox.width / 2, cellBox.y + cellBox.height / 2, {
        steps: 10,
    });
    await page.mouse.up();
    await page.waitForTimeout(500);
}

/** Clicks `weekIndex`'s column in the timeline header, zooming into its day view (#445). */
async function zoomIntoWeek(page: Page, weekIndex: number): Promise<void> {
    // Anchor on the table that actually holds the gantt rows, rather than "the
    // first visible thead on the page". Visible-only was necessary -- tabs the
    // test has already visited stay mounted behind `display: none` and their
    // tables have a thead too (#495) -- but it is not sufficient: the timeline
    // tab renders more than one visible table, so `.first()` could take a
    // header belonging to a different one and then click a column that is not
    // the week asked for. That is why zooming to week 2 left week 1's event in
    // the sidebar: the zoom never moved.
    const timelineTable = page
        .locator("table")
        .filter({ has: page.locator('[id^="gantt-row-"]') })
        .filter({ visible: true })
        .first();
    const weekHeader = timelineTable
        .locator("thead tr")
        .first()
        .locator("th, td")
        .nth(weekIndex + 1);
    // The timeline scrolls horizontally: a later week's header can resolve
    // while sitting outside the viewport (#585).
    await weekHeader.scrollIntoViewIfNeeded();
    await expect(weekHeader).toBeVisible({ timeout: 10_000 });
    await weekHeader.click();
    await page.waitForTimeout(300);
}

test.describe("Gantt Recurring Events (#111)", () => {
    // Each test builds a syllabus/module/event hierarchy from scratch (several
    // sequential API round-trips) before touching the timeline — comfortably
    // under the default 15s on a healthy machine, but tight under load.
    test.describe.configure({ timeout: 60_000 });

    test.beforeEach(async ({ page }) => {
        await page.goto("/gantt");
        await waitForAppLoad(page);
        await createAndSelectCurriculum(page);
        // Two weeks: enough to distinguish "satisfied" (starts week 1) from
        // "not yet satisfied" (a later week wouldn't cover week 1).
        await addWeeks(page, 2);
    });

    test("weekly recurring event repeats into every later week once mapped to the first week", async ({
        page,
    }) => {
        const eventTitle = await createModuleWithEvents(page);
        await setEventRecurrence(page, eventTitle, "שבועי");

        await page.getByRole("tab", { name: "רצף זמן" }).click();
        await page.waitForTimeout(500);

        const eventRow = await getTimelineEventRow(page, eventTitle);
        await expect(eventRow).toBeVisible({ timeout: 10_000 });

        // Before mapping: an unallocated marker (draggable, no recurrence echo yet).
        const stagedBlock = eventRow.locator('[id^="block-event-"]');
        await expect(stagedBlock).toBeVisible({ timeout: 10_000 });
        await expect(eventRow.locator("[data-gantt-recurrence]")).toHaveCount(0);

        // Map it — a small drag within the same (first-week) cell.
        await dragBlockWithinItsCell(page, stagedBlock);

        // Now mapped in week 1 ⇒ recurrence satisfied ⇒ a repeat echo appears
        // in every later week (we added 2 weeks total, so exactly one echo).
        await expect(eventRow.locator("[data-gantt-recurrence]")).toHaveCount(1, {
            timeout: 10_000,
        });
    });

    test("shows an unallocated marker for an unmapped recurring event", async ({
        page,
    }) => {
        const eventTitle = await createModuleWithEvents(page);
        await setEventRecurrence(page, eventTitle, "יומי");

        await page.getByRole("tab", { name: "רצף זמן" }).click();
        await page.waitForTimeout(500);

        const eventRow = await getTimelineEventRow(page, eventTitle);
        await expect(eventRow).toBeVisible({ timeout: 10_000 });

        // Recurrence unsatisfied (never mapped) ⇒ a draggable staged block sits
        // in the first column, and no repeat echoes exist yet.
        await expect(eventRow.locator('[id^="block-event-"]')).toBeVisible({
            timeout: 10_000,
        });
        await expect(eventRow.locator("[data-gantt-recurrence]")).toHaveCount(0);
    });

    test("non-recurring events are unaffected by the recurrence machinery", async ({
        page,
    }) => {
        const eventTitle = await createModuleWithEvents(page);
        // Leave recurrence at its default (ללא / None) — just open+close to
        // exercise the same dialog path without setting anything.
        const eventDialog = await openEventEditDialog(page, eventTitle);
        await closeEventAndModuleDialogs(page, eventDialog);

        await page.getByRole("tab", { name: "רצף זמן" }).click();
        await page.waitForTimeout(500);

        const eventRow = await getTimelineEventRow(page, eventTitle);
        await expect(eventRow).toBeVisible({ timeout: 10_000 });
        await expect(eventRow.locator("[data-gantt-recurrence]")).toHaveCount(0);
    });

    test("an occurrence is materialized only once 'edit just this one' is chosen (#833)", async ({
        page,
    }) => {
        const eventTitle = await createModuleWithEvents(page);
        await setEventRecurrence(page, eventTitle, "שבועי");

        await page.getByRole("tab", { name: "רצף זמן" }).click();
        await page.waitForTimeout(500);

        const eventRow = await getTimelineEventRow(page, eventTitle);
        await mapEventToFirstWeek(page, eventRow);

        const occurrence = eventRow.locator("[data-gantt-recurrence]").first();
        await expect(occurrence).toBeVisible({ timeout: 10_000 });

        const eventRowCountBefore = await page
            .locator('[id^="gantt-row-event-"]')
            .count();

        await occurrence.dblclick();

        // Opening asks first; nothing has been written yet.
        const choice = page.getByRole("menuitem", { name: /עריכת מופע זה בלבד/ });
        await expect(choice).toBeVisible({ timeout: 10_000 });
        await expect(page.locator('[id^="gantt-row-event-"]')).toHaveCount(eventRowCountBefore);
        await choice.click();

        // A new, independent event row appears in the module.
        await expect(page.locator('[id^="gantt-row-event-"]')).toHaveCount(
            eventRowCountBefore + 1,
            { timeout: 10_000 },
        );

        // The source event no longer echoes onto the materialized day.
        await expect(eventRow.locator("[data-gantt-recurrence]")).toHaveCount(0, {
            timeout: 10_000,
        });
    });

    test("dragging a recurrence occurrence to the first column deletes that occurrence", async ({
        page,
    }) => {
        const eventTitle = await createModuleWithEvents(page);
        await setEventRecurrence(page, eventTitle, "שבועי");

        await page.getByRole("tab", { name: "רצף זמן" }).click();
        await page.waitForTimeout(500);

        const eventRow = await getTimelineEventRow(page, eventTitle);
        await mapEventToFirstWeek(page, eventRow);

        const occurrence = eventRow.locator("[data-gantt-recurrence]").first();
        await expect(occurrence).toBeVisible({ timeout: 10_000 });

        await dragBlockToRemoveColumn(page, occurrence, eventRow);

        await expect(eventRow.locator("[data-gantt-recurrence]")).toHaveCount(0, {
            timeout: 10_000,
        });

        // Survives reload — the deletion is persisted as an exception, not just
        // an optimistic UI update.
        await page.reload();
        await waitForAppLoad(page);
        await page.getByRole("tab", { name: "רצף זמן" }).click();
        await page.waitForTimeout(500);
        const eventRowAfterReload = await getTimelineEventRow(page, eventTitle);
        await expect(
            eventRowAfterReload.locator("[data-gantt-recurrence]"),
        ).toHaveCount(0, { timeout: 10_000 });
    });

    test("the module block spans through surviving recurrence occurrences", async ({
        page,
    }) => {
        // A third week so the recurrence echoes twice, giving the module block
        // room to visibly outgrow the event's own single-week block.
        await addWeeks(page, 1);

        const eventTitle = await createModuleWithEvents(page);
        await setEventRecurrence(page, eventTitle, "שבועי");

        await page.getByRole("tab", { name: "רצף זמן" }).click();
        await page.waitForTimeout(500);

        const eventRow = await getTimelineEventRow(page, eventTitle);
        await mapEventToFirstWeek(page, eventRow);

        await expect(eventRow.locator("[data-gantt-recurrence]")).toHaveCount(2, {
            timeout: 10_000,
        });

        const moduleBlockBox = await page
            .locator('td:not(:first-child) [id^="block-module-"]')
            .filter({ hasNotText: "הפסקות" })
            .boundingBox();
        const eventBlockBox = await page
            .locator('[id^="block-event-"]')
            .first()
            .boundingBox();

        expect(moduleBlockBox).not.toBeNull();
        expect(eventBlockBox).not.toBeNull();
        expect(moduleBlockBox!.width).toBeGreaterThan(eventBlockBox!.width);
    });

    test("day-view sidebar hides events mapped outside the zoomed week (#445)", async ({
        page,
    }) => {
        const lectureTitle = await createModuleWithEvents(page);
        // Leave recurrence at its default (ללא) — just open+close to close the
        // module dialog without setting anything.
        const eventDialog = await openEventEditDialog(page, lectureTitle);
        await closeEventAndModuleDialogs(page, eventDialog);

        const exerciseTitle = 'ע"ע';

        await page.getByRole("tab", { name: "רצף זמן" }).click();
        await page.waitForTimeout(500);

        // Not recurring, so there is no staged block in week 1's grid cell to
        // nudge: an unmapped non-recurring event's only block lives in the
        // sticky label cell, and that cell is the *remove* droppable — a nudge
        // there drops on nothing. Drop on the week cell instead (#654).
        const lectureRow = await getTimelineEventRow(page, lectureTitle);
        await mapEventToWeek(page, lectureRow, 0);

        const exerciseRow = await getTimelineEventRow(page, exerciseTitle);
        await mapEventToWeek(page, exerciseRow, 1);

        // Zoom into week 1's day view: only the lecture (mapped there) should
        // stay in the sidebar; the exercise (mapped to week 2) drops out.
        await zoomIntoWeek(page, 0);
        await expect(page.locator('[id^="gantt-row-event-"]').filter({ hasText: lectureTitle })).toBeVisible({
            timeout: 10_000,
        });
        await expect(
            page.locator('[id^="gantt-row-event-"]').filter({ hasText: exerciseTitle }),
        ).toHaveCount(0);

        // Back to weekly view, then zoom into week 2: the opposite holds.
        await page.getByRole("button", { name: "שבועי", exact: true }).click();
        await page.waitForTimeout(300);
        await zoomIntoWeek(page, 1);

        await expect(
            page.locator('[id^="gantt-row-event-"]').filter({ hasText: exerciseTitle }),
        ).toBeVisible({ timeout: 10_000 });
        await expect(
            page.locator('[id^="gantt-row-event-"]').filter({ hasText: lectureTitle }),
        ).toHaveCount(0);
    });

    test("module blocks are not draggable in zoomed day view, only event blocks are (#640)", async ({
        page,
    }) => {
        const lectureTitle = await createModuleWithEvents(page);
        const eventDialog = await openEventEditDialog(page, lectureTitle);
        await closeEventAndModuleDialogs(page, eventDialog);

        await page.getByRole("tab", { name: "רצף זמן" }).click();
        await page.waitForTimeout(500);

        // Non-recurring: map via the week cell, not the nudge — see #654 above.
        const lectureRow = await getTimelineEventRow(page, lectureTitle);
        await mapEventToWeek(page, lectureRow, 0);

        await zoomIntoWeek(page, 0);

        // Two things make a bare `.first()` pick the wrong element here:
        // every curriculum carries an auto-seeded "הפסקות" module that sorts
        // first, and an unmapped module renders a second block with the same
        // id inside the sticky label column — that one is a "map me"
        // placeholder and stays draggable by design. Only the grid block is
        // the subject of #640, so scope to the day cells.
        const moduleBlock = page
            .locator('td:not(:first-child) [id^="block-module-"]')
            .filter({ hasNotText: "הפסקות" })
            .first();
        await expect(moduleBlock).toBeVisible({ timeout: 10_000 });
        await expect(moduleBlock).toHaveCSS("cursor", "default");

        const boxBefore = await moduleBlock.boundingBox();
        if (!boxBefore) throw new Error("Module block not found");
        await page.mouse.move(
            boxBefore.x + boxBefore.width / 2,
            boxBefore.y + boxBefore.height / 2,
        );
        await page.mouse.down();
        await page.mouse.move(boxBefore.x + boxBefore.width / 2 + 30, boxBefore.y, {
            steps: 8,
        });
        await page.mouse.up();
        await page.waitForTimeout(300);

        const boxAfter = await moduleBlock.boundingBox();
        expect(boxAfter?.x).toBeCloseTo(boxBefore.x, 0);

        // The event block in the same zoomed week stays draggable. Scoped to
        // this test's own row for the same reason as the module block above:
        // the seeded meal events have blocks too.
        const eventBlock = (await getTimelineEventRow(page, lectureTitle))
            .locator('[id^="block-event-"]')
            .first();
        await expect(eventBlock).toBeVisible({ timeout: 10_000 });
        await expect(eventBlock).not.toHaveCSS("cursor", "default");
    });
});
