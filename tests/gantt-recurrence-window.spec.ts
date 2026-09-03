import { Locator, Page } from "@playwright/test";

import { test, expect, waitForAppLoad } from "./fixtures";

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

/**
 * The first *visible* "edit event" trigger.
 *
 * `.first()` on its own picks whatever comes first in the DOM, hidden or not,
 * and the curriculum view leaves every visited tab mounted behind
 * `display: none`. Filtering first is what makes "first" mean "the one on
 * screen" (#495).
 */
function visibleEditEventTrigger(page: Page): Locator {
    return page.getByTitle("עריכת המופע").filter({ visible: true }).first();
}

/**
 * The module dialog is what hosts the "עריכת המופע" triggers, and it goes away
 * when the curriculum view switches tabs (e.g. to "רצף זמן" and back), so a
 * test that opened it earlier cannot assume it is still usable (#585, #589).
 * Reopens it from the syllabuses tab when it is gone; a no-op when it is not.
 *
 * Every locator here filters to visible (#495). The curriculum view keeps each
 * *visited* tab mounted and merely hides it — `display: none`, see
 * `curriculum-view/tabs/index.tsx` — so a page-wide locator goes on matching
 * nodes in tabs the test has already left. Counting those made this helper
 * report an already-open dialog when the only match was a hidden leftover, and
 * the click that followed then waited out the whole 60s test timeout on an
 * element that could never become visible.
 */
async function ensureModuleDialogOpen(page: Page): Promise<void> {
    const editEventTrigger = visibleEditEventTrigger(page);
    if ((await editEventTrigger.count()) > 0) return;

    await page.getByRole("tab", { name: "סילבוסים" }).click();

    // Tooltip+IconButton: MUI puts the label on the button, or on a wrapping
    // <span> — match either, the same way createModuleWithEvents does.
    const editModuleButton = page
        .locator(
            'button[aria-label="עריכת מערך"], span[title="עריכת מערך"] button, span[aria-label="עריכת מערך"] button',
        )
        .first();
    await expect(editModuleButton).toBeVisible({ timeout: 10_000 });
    await editModuleButton.click();

    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 10_000 });
    await expect(editEventTrigger).toBeVisible({ timeout: 10_000 });
}

async function openEventEditDialog(
    page: Page,
    eventTitle: string,
): Promise<Locator> {
    await ensureModuleDialogOpen(page);
    await visibleEditEventTrigger(page).click();

    const eventDialog = page
        .getByRole("dialog")
        .filter({ hasText: `עריכת מופע: ${eventTitle}` });
    await expect(eventDialog).toBeVisible({ timeout: 10_000 });
    return eventDialog;
}

async function closeEventAndModuleDialogs(
    page: Page,
    eventDialog: Locator,
): Promise<void> {
    await eventDialog.getByRole("button", { name: "סגירה" }).click();
    await expect(eventDialog).not.toBeVisible();

    const moduleDialog = page.getByRole("dialog");
    if ((await moduleDialog.count()) > 0) {
        const closeButton = moduleDialog.getByRole("button", { name: "סגירה" });
        if ((await closeButton.count()) > 0) {
            await closeButton.click();
        } else {
            await page.keyboard.press("Escape");
        }
    }
    await page.waitForTimeout(300);
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
    await dragBlockWithinItsCell(page, stagedBlock);
}

async function openTimeline(page: Page): Promise<void> {
    await page.getByRole("tab", { name: "רצף זמן" }).click();
    await page.waitForTimeout(500);
}

test.describe("Gantt recurrence window and skipped occurrences (#468, #469)", () => {
    test.describe.configure({ timeout: 60_000 });

    test.beforeEach(async ({ page }) => {
        await page.goto("/gantt");
        await waitForAppLoad(page);
        await createAndSelectCurriculum(page);
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
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + 8);
        await page.getByRole("tab", { name: "סילבוסים" }).click();
        await configureRecurrence(page, eventTitle, {
            recurrenceLabel: "שבועי",
            endDate: endDate.toISOString().slice(0, 10),
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
