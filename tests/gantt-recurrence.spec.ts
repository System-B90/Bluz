import { Locator, Page } from "@playwright/test";

import { test, expect, waitForAppLoad } from "./fixtures";

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

async function createAndSelectCurriculum(page: Page): Promise<void> {
    const fab = page.getByRole("button", { name: "גאנטים" });
    await fab.click();

    // The create trigger stays disabled until the panel's async curriculum
    // fetch resolves (skeleton loaders visible until then) — wait it out,
    // otherwise the click below retries against a disabled button for the
    // full test timeout instead of failing fast.
    await page.locator(".MuiSkeleton-root").first().waitFor({ state: "hidden", timeout: 10_000 }).catch(() => {});

    // The concrete create actions (draft/duplicate/template) are hidden behind
    // a hover-reveal trigger. Hover (not click!) reveals it: the trigger's
    // onClick toggles `expanded` off the *previous* value, and a real mouse
    // interaction fires `mouseenter` (opening it via hover) before the click
    // handler runs (immediately closing what hover just opened). Hovering
    // matches the component's own desktop-mouse design intent.
    const createTrigger = page.getByRole("button", { name: "גאנט חדש" });
    await expect(createTrigger).toBeEnabled({ timeout: 10_000 });
    await createTrigger.hover();

    const draftButton = page.getByRole("button", { name: "דראפט חדש" });
    await expect(draftButton).toBeVisible({ timeout: 10_000 });
    await draftButton.click();

    await expect(page).toHaveURL(/cid=/, { timeout: 10_000 });
    await page.keyboard.press("Escape");

    // Escape starts the popover's exit transition; its backdrop stays mounted
    // and keeps swallowing pointer events until that finishes. A fixed 300ms
    // was enough on an idle machine but not on a loaded one, and the next
    // click then waited out the whole test budget on an element that was
    // visible and enabled but could never receive the click — reported as
    // "Target page, context or browser has been closed" after teardown.
    await expect(page.locator(".MuiBackdrop-root")).toHaveCount(0, {
        timeout: 15_000,
    });
}

/** Adds `count` weeks to the currently-selected curriculum via the weeks tab. */
async function addWeeks(page: Page, count: number): Promise<void> {
    await page.getByRole("tab", { name: "שבועות" }).click();

    const manageButton = page.getByRole("button", { name: "ניהול אורך קורס" });
    await expect(manageButton).toBeVisible({ timeout: 10_000 });

    // The gantt renders its cards progressively (useProgressiveItemCount), so
    // the layout keeps shifting while skeletons are still being replaced.
    // Playwright requires an element to hold still before it will click it, and
    // under load that never happened inside the test budget — surfacing as
    // "Target page, context or browser has been closed" once the run was torn
    // down. Wait for the skeletons to go instead.
    await expect(page.locator(".MuiSkeleton-root")).toHaveCount(0, {
        timeout: 30_000,
    });

    for (let i = 0; i < count; i++) {
        await manageButton.click();
        await page
            .getByRole("menuitem", { name: "הוספת שבוע לסוף הקורס" })
            .click();
        await page.waitForTimeout(300);
    }
}

/**
 * Creates a syllabus and a module (via the "create module" action, which also
 * seeds two default events: a lecture "הרצאת מבוא" and an exercise 'ע"ע', and
 * opens the module dialog). Returns the lecture event's title for lookup.
 */
async function createModuleWithEvents(page: Page): Promise<string> {
    await page.getByRole("tab", { name: "סילבוסים" }).click();

    await page.getByRole("button", { name: "סילבוס חדש" }).click();
    await page.waitForTimeout(300);

    // The new syllabus card starts expanded — its actions are already visible.

    // Plain Tooltip+IconButton (no aria-label on the button itself — MUI's
    // Tooltip puts aria-label on the wrapping <span>, not the inner <button>).
    const createModuleButton = page
        .locator(
            'span[title="יצירת מערך חדש"] button, span[aria-label="יצירת מערך חדש"] button',
        )
        .first();
    await expect(createModuleButton).toBeVisible({ timeout: 10_000 });
    await createModuleButton.click();

    // Creating the module opens its dialog automatically.
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 10_000 });

    return "הרצאת מבוא";
}

/** Opens the event dialog for `eventTitle` (must be visible in an open module dialog). */
async function openEventEditDialog(page: Page, eventTitle: string): Promise<Locator> {
    await page.getByTitle("עריכת המופע").first().click();

    const eventDialog = page
        .getByRole("dialog")
        .filter({ hasText: `עריכת מופע: ${eventTitle}` });
    await expect(eventDialog).toBeVisible({ timeout: 10_000 });
    return eventDialog;
}

/**
 * Closes an open event dialog, then the module dialog behind it. Waits for the
 * event dialog to fully unmount before checking for the module dialog — doing
 * this check too early can match the still-fading-out event dialog too,
 * confusing which "סגירה" button gets clicked.
 */
async function closeEventAndModuleDialogs(
    page: Page,
    eventDialog: Locator,
): Promise<void> {
    await eventDialog.getByRole("button", { name: "סגירה" }).click();
    await expect(eventDialog).not.toBeVisible();

    const moduleDialog = page.getByRole("dialog");
    if (await moduleDialog.count() > 0) {
        const closeButton = moduleDialog.getByRole("button", { name: "סגירה" });
        if (await closeButton.count() > 0) {
            await closeButton.click();
        } else {
            await page.keyboard.press("Escape");
        }
    }
    await page.waitForTimeout(300);
}

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
        .locator(".MuiFormControl-root")
        .filter({ hasText: "חזרה" })
        .getByRole("combobox");
    await expect(recurrenceSelect).toBeVisible({ timeout: 5_000 });
    await recurrenceSelect.click();

    await page.getByRole("option", { name: recurrenceLabel }).click();
    await expect(recurrenceSelect).toHaveText(recurrenceLabel);

    await closeEventAndModuleDialogs(page, eventDialog);
}

/**
 * Expands the module row created by `createModuleWithEvents` on the "רצף זמן"
 * timeline so its event rows render, then locates the event's row by its label
 * text.
 *
 * Curricula now seed a default "פסקות" (breaks) module alongside the one this
 * test creates, so the module-row locator must exclude it to stay unambiguous.
 */
async function getTimelineEventRow(
    page: Page,
    eventTitle: string,
): Promise<Locator> {
    const moduleRow = page
        .locator('[id^="gantt-row-module-"]')
        .filter({ hasNotText: "פסקות" });
    await expect(moduleRow).toBeVisible({ timeout: 10_000 });

    const eventRow = page
        .locator('[id^="gantt-row-event-"]')
        .filter({ hasText: eventTitle });

    if ((await eventRow.count()) === 0) {
        // Module rows start collapsed; the "▶"/"▼" toggle has no accessible
        // name, so it's targeted structurally within the module row.
        await moduleRow.locator("span").filter({ hasText: "▶" }).first().click();
    }

    return eventRow;
}

/** Drags the row's staged/anchor block by a few px within its own cell, to trigger a map-to-day drop. */
async function dragBlockWithinItsCell(page: Page, block: Locator): Promise<void> {
    const box = await block.boundingBox();
    if (!box) throw new Error("Gantt block not found for drag");

    const startX = box.x + box.width / 2;
    const startY = box.y + box.height / 2;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 20, startY, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(500);
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

/** Maps `eventTitle`'s recurring event to the first week/day, satisfying its recurrence. */
async function mapEventToFirstWeek(page: Page, eventRow: Locator): Promise<void> {
    const stagedBlock = eventRow.locator('[id^="block-event-"]');
    await expect(stagedBlock).toBeVisible({ timeout: 10_000 });
    await dragBlockWithinItsCell(page, stagedBlock);
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

    test("double-clicking a recurrence occurrence materializes it into a standalone event", async ({
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
            .locator('[id^="block-module-"]')
            .filter({ hasNotText: "פסקות" })
            .boundingBox();
        const eventBlockBox = await page
            .locator('[id^="block-event-"]')
            .first()
            .boundingBox();

        expect(moduleBlockBox).not.toBeNull();
        expect(eventBlockBox).not.toBeNull();
        expect(moduleBlockBox!.width).toBeGreaterThan(eventBlockBox!.width);
    });
});
