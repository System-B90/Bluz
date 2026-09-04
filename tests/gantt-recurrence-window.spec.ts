import { Locator, Page } from "@playwright/test";

import {
    closeEventAndModuleDialogs,
    expect,
    openEventEditDialog,
    test,
    waitForAppLoad,
} from "./fixtures";

/**
 * #468 (configurable recurrence window) and #469 (skipped occurrences shown as
 * restorable ghosts), driven through the real timeline.
 *
 * The setup mirrors gantt-recurrence.spec.ts: each test builds its own
 * curriculum so the timeline starts empty and deterministic.
 */

async function createAndSelectCurriculum(page: Page): Promise<void> {
    const fab = page.getByRole("button", { name: "גאנטים" });
    await fab.click();

    await page
        .locator(".MuiSkeleton-root")
        .first()
        .waitFor({ state: "hidden", timeout: 10_000 })
        .catch(() => {});

    const createTrigger = page.getByRole("button", { name: "גאנט חדש" });
    await expect(createTrigger).toBeEnabled({ timeout: 10_000 });
    await createTrigger.hover();

    const draftButton = page.getByRole("button", { name: "דראפט חדש" });
    await expect(draftButton).toBeVisible({ timeout: 10_000 });
    await draftButton.click();

    await expect(page).toHaveURL(/cid=/, { timeout: 10_000 });
    await page.keyboard.press("Escape");
    await expect(page.locator(".MuiBackdrop-root")).toHaveCount(0, {
        timeout: 15_000,
    });
}

async function addWeeks(page: Page, count: number): Promise<void> {
    await page.getByRole("tab", { name: "שבועות" }).click();

    const manageButton = page.getByRole("button", { name: "ניהול אורך קורס" });
    await expect(manageButton).toBeVisible({ timeout: 10_000 });
    await expect(page.locator(".MuiSkeleton-root")).toHaveCount(0, {
        timeout: 30_000,
    });

    for (let i = 0; i < count; i++) {
        await manageButton.click({ timeout: 20_000 });
        const addWeekItem = page.getByRole("menuitem", {
            name: "הוספת שבוע לסוף הקורס",
        });
        await expect(addWeekItem).toBeVisible({ timeout: 15_000 });
        await addWeekItem.click();
        await expect(page.getByRole("menu")).toHaveCount(0, { timeout: 15_000 });
    }
}

async function createModuleWithEvents(page: Page): Promise<string> {
    await page.getByRole("tab", { name: "סילבוסים" }).click();
    await page.getByRole("button", { name: "סילבוס חדש" }).click();
    await page.waitForTimeout(300);

    const createModuleButton = page
        .locator(
            'span[title="יצירת מערך חדש"] button, span[aria-label="יצירת מערך חדש"] button',
        )
        .first();
    await expect(createModuleButton).toBeVisible({ timeout: 10_000 });
    await createModuleButton.click();

    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 10_000 });
    return "הרצאת מבוא";
}





/** Sets recurrence and, optionally, the recurrence window dates (#468). */
async function configureRecurrence(
    page: Page,
    eventTitle: string,
    options: {
        recurrenceLabel: "יומי" | "שבועי";
        startDate?: string;
        endDate?: string;
    },
): Promise<void> {
    const eventDialog = await openEventEditDialog(page, eventTitle);
    await eventDialog.getByText("שיבוץ ודרישות").click();

    const recurrenceSelect = eventDialog
        .locator(".MuiFormControl-root")
        .filter({ hasText: "חזרה" })
        .getByRole("combobox");
    await expect(recurrenceSelect).toBeVisible({ timeout: 5_000 });
    await recurrenceSelect.click();
    await page.getByRole("option", { name: options.recurrenceLabel }).click();
    await expect(recurrenceSelect).toHaveText(options.recurrenceLabel);

    // The window fields only exist once the event actually recurs.
    const startField = eventDialog.getByLabel("תחילת חזרתיות");
    const endField = eventDialog.getByLabel("סיום חזרתיות");
    await expect(startField).toBeVisible({ timeout: 5_000 });

    if (options.startDate) {
        await startField.fill(options.startDate);
        await startField.blur();
    }
    if (options.endDate) {
        await endField.fill(options.endDate);
        await endField.blur();
    }

    await closeEventAndModuleDialogs(page, eventDialog);
}

async function getTimelineEventRow(
    page: Page,
    eventTitle: string,
): Promise<Locator> {
    const moduleRow = page
        .locator('[id^="gantt-row-module-"]')
        .filter({ hasNotText: "הפסקות" });
    await expect(moduleRow).toBeVisible({ timeout: 10_000 });

    const eventRow = page
        .locator('[id^="gantt-row-event-"]')
        .filter({ hasText: eventTitle });

    if ((await eventRow.count()) === 0) {
        await moduleRow.locator("span").filter({ hasText: "▶" }).first().click();
    }

    return eventRow;
}

async function dragBlockWithinItsCell(
    page: Page,
    block: Locator,
): Promise<void> {
    const box = await block.boundingBox();
    if (!box) throw new Error("Gantt block not found for drag");

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 20, box.y + box.height / 2, {
        steps: 8,
    });
    await page.mouse.up();
    await page.waitForTimeout(500);
}

async function dragBlockToRemoveColumn(
    page: Page,
    block: Locator,
    row: Locator,
): Promise<void> {
    const blockBox = await block.boundingBox();
    const cellBox = await row.locator("td").first().boundingBox();
    if (!blockBox || !cellBox) {
        throw new Error("Block or remove cell not found for drag");
    }

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

async function mapEventToFirstWeek(
    page: Page,
    eventRow: Locator,
): Promise<void> {
    const stagedBlock = eventRow.locator('[id^="block-event-"]');
    await expect(stagedBlock).toBeVisible({ timeout: 10_000 });
    // The nudge drops the block on the day it already sits over, which is what
    // the recurrence-window assertions count from. Dropping on the week cell's
    // centre instead lands mid-week and changes every expected echo.
    await dragBlockWithinItsCell(page, stagedBlock);
}

async function openTimeline(page: Page): Promise<void> {
    await page.getByRole("tab", { name: "רצף זמן" }).click();
    await page.waitForTimeout(500);
}

/**
 * "YYYY-MM-DD" `offsetDays` from today, in local time.
 *
 * Not `toISOString().slice(0, 10)`: that converts to UTC first, and the app
 * runs in Asia/Jerusalem while CI's clock is UTC, so near midnight the two
 * disagree by a day -- which for this spec means the window lands exactly on
 * an echo boundary instead of between two. Same class of bug as #567.
 */
function dateInAppTimezone(offsetDays: number): string {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    const month = `${d.getMonth() + 1}`.padStart(2, "0");
    const day = `${d.getDate()}`.padStart(2, "0");
    return `${d.getFullYear()}-${month}-${day}`;
}

test.describe("Gantt recurrence window and skipped occurrences (#468, #469)", () => {
    test.describe.configure({ timeout: 60_000 });

    test.beforeEach(async ({ page }) => {
        await page.goto("/gantt");
        await waitForAppLoad(page);
        await createAndSelectCurriculum(page);

        // Give the curriculum a real start date before anything relies on the
        // recurrence window.
        //
        // A new draft has `startDate: null`, so its days carry no calendar
        // date, and `isDayInRecurrenceWindow` (api-shared/gantt/recurrence.ts)
        // treats an unresolvable date as "inside the window" by design -- the
        // window is a restriction on top of the echo, not a second source of
        // truth for it. The upshot is that on a dateless curriculum the window
        // is silently a no-op, so "a recurrence end date stops the echo early"
        // could never pass here: it asserted 1 echo and always saw 2. The
        // test's premise that "the curriculum starts today" was simply never
        // true.
        const curriculumId = new URL(page.url()).searchParams.get("cid");
        expect(curriculumId, "curriculum id must be in the URL").toBeTruthy();
        const startDate = dateInAppTimezone(0);
        const patched = await page.request.patch(
            `/api/gantt/curriculums/${curriculumId}`,
            { data: { startDate } },
        );
        expect(patched.ok(), "curriculum start date must be set").toBeTruthy();
        await page.reload();
        await waitForAppLoad(page);

        // Three weeks: two echo targets, so a window can cut exactly one.
        await addWeeks(page, 3);
    });

    test("recurrence window fields appear only for a recurring event (#468)", async ({
        page,
    }) => {
        const eventTitle = await createModuleWithEvents(page);
        const eventDialog = await openEventEditDialog(page, eventTitle);
        await eventDialog.getByText("שיבוץ ודרישות").click();

        // Default recurrence is ללא — no window to configure.
        await expect(eventDialog.getByLabel("תחילת חזרתיות")).toHaveCount(0);

        const recurrenceSelect = eventDialog
            .locator(".MuiFormControl-root")
            .filter({ hasText: "חזרה" })
            .getByRole("combobox");
        await recurrenceSelect.click();
        await page.getByRole("option", { name: "שבועי" }).click();

        await expect(eventDialog.getByLabel("תחילת חזרתיות")).toBeVisible({
            timeout: 5_000,
        });
        await expect(eventDialog.getByLabel("סיום חזרתיות")).toBeVisible();

        await closeEventAndModuleDialogs(page, eventDialog);
    });

    test("a recurrence end date stops the echo early (#468)", async ({
        page,
    }) => {
        const eventTitle = await createModuleWithEvents(page);
        await configureRecurrence(page, eventTitle, {
            recurrenceLabel: "שבועי",
        });

        await openTimeline(page);
        const eventRow = await getTimelineEventRow(page, eventTitle);
        await mapEventToFirstWeek(page, eventRow);

        // Unbounded: an echo in each of the two later weeks.
        await expect(eventRow.locator("[data-gantt-recurrence]")).toHaveCount(2, {
            timeout: 10_000,
        });

        // A window that ends before the timeline does removes the later echo.
        // The curriculum starts today, so "a week from now" keeps exactly one.

        await page.getByRole("tab", { name: "סילבוסים" }).click();
        await configureRecurrence(page, eventTitle, {
            recurrenceLabel: "שבועי",
            endDate: dateInAppTimezone(8),
        });

        await openTimeline(page);
        const boundedRow = await getTimelineEventRow(page, eventTitle);
        await expect(
            boundedRow.locator("[data-gantt-recurrence]"),
        ).toHaveCount(1, { timeout: 10_000 });
    });

    test("a skipped occurrence stays visible as a ghost and explains itself (#469)", async ({
        page,
    }) => {
        const eventTitle = await createModuleWithEvents(page);
        await configureRecurrence(page, eventTitle, {
            recurrenceLabel: "שבועי",
        });

        await openTimeline(page);
        const eventRow = await getTimelineEventRow(page, eventTitle);
        await mapEventToFirstWeek(page, eventRow);

        const occurrence = eventRow.locator("[data-gantt-recurrence]").first();
        await expect(occurrence).toBeVisible({ timeout: 10_000 });

        await dragBlockToRemoveColumn(page, occurrence, eventRow);

        // The occurrence is gone, but its ghost marks the hole it left.
        const ghost = eventRow.locator("[data-gantt-skipped]");
        await expect(ghost).toHaveCount(1, { timeout: 10_000 });

        await ghost.first().hover();
        await expect(page.getByRole("tooltip")).toContainText("דולג", {
            timeout: 5_000,
        });
    });

    test("double-clicking a skipped ghost restores the occurrence (#469)", async ({
        page,
    }) => {
        const eventTitle = await createModuleWithEvents(page);
        await configureRecurrence(page, eventTitle, {
            recurrenceLabel: "שבועי",
        });

        await openTimeline(page);
        const eventRow = await getTimelineEventRow(page, eventTitle);
        await mapEventToFirstWeek(page, eventRow);

        const occurrenceCountBefore = await eventRow
            .locator("[data-gantt-recurrence]")
            .count();

        await dragBlockToRemoveColumn(
            page,
            eventRow.locator("[data-gantt-recurrence]").first(),
            eventRow,
        );

        const ghost = eventRow.locator("[data-gantt-skipped]").first();
        await expect(ghost).toBeVisible({ timeout: 10_000 });

        await ghost.dblclick();

        // Back to a live occurrence, and no ghost left behind.
        await expect(eventRow.locator("[data-gantt-skipped]")).toHaveCount(0, {
            timeout: 10_000,
        });
        await expect(eventRow.locator("[data-gantt-recurrence]")).toHaveCount(
            occurrenceCountBefore,
            { timeout: 10_000 },
        );
    });

    test("a materialized occurrence gets no restorable ghost (#469)", async ({
        page,
    }) => {
        const eventTitle = await createModuleWithEvents(page);
        await configureRecurrence(page, eventTitle, {
            recurrenceLabel: "שבועי",
        });

        await openTimeline(page);
        const eventRow = await getTimelineEventRow(page, eventTitle);
        await mapEventToFirstWeek(page, eventRow);

        const occurrence = eventRow.locator("[data-gantt-recurrence]").first();
        await expect(occurrence).toBeVisible({ timeout: 10_000 });
        await occurrence.dblclick();

        // The day now holds a standalone event, so restoring would double-book
        // it — no ghost is offered for that day.
        await expect(eventRow.locator("[data-gantt-skipped]")).toHaveCount(0, {
            timeout: 10_000,
        });
    });
});
