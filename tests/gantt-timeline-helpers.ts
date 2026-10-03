import { Locator, Page } from "@playwright/test";

import { createSyllabusViaUi, expect, expectNoOpenModal } from "./fixtures";

/**
 * Shared steps for specs that build a curriculum from scratch and work on
 * the רצף זמן timeline. Moved out of gantt-recurrence.spec.ts so
 * gantt-timeline-ux.spec.ts can reuse them.
 */

export async function createAndSelectCurriculum(page: Page): Promise<void> {
    const fab = page.getByRole("button", { name: "גאנטים" });
    await fab.click();

    // The create trigger stays disabled until the panel's async curriculum
    // fetch resolves (skeleton loaders visible until then) — wait it out,
    // otherwise the click below retries against a disabled button for the
    // full test timeout instead of failing fast.
    await page.locator(".MuiSkeleton-root").first().waitFor({ state: "hidden", timeout: 10_000 }).catch(() => {});

    const draftButton = page.getByRole("button", { name: "דראפט חדש" });
    await expect(draftButton).toBeEnabled({ timeout: 10_000 });
    await draftButton.click();

    await expect(page).toHaveURL(/gc=/, { timeout: 10_000 });
    await page.keyboard.press("Escape");

    // Escape starts the popover's exit transition; its backdrop stays mounted
    // and keeps swallowing pointer events until that finishes. A fixed 300ms
    // was enough on an idle machine but not on a loaded one, and the next
    // click then waited out the whole test budget on an element that was
    // visible and enabled but could never receive the click — reported as
    // "Target page, context or browser has been closed" after teardown.
    await expectNoOpenModal(page, 15_000);
}

/** Adds `count` weeks to the currently-selected curriculum via the weeks tab. */
export async function addWeeks(page: Page, count: number): Promise<void> {
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
        // Explicit timeout so an unactionable button is reported as such —
        // with the element that intercepts the click — instead of consuming
        // the whole test budget and surfacing as "Target page, context or
        // browser has been closed" once Playwright tears the run down.
        await manageButton.click({ timeout: 20_000 });

        // Wait for the menu rather than assuming the click opened it. Adding a
        // week re-renders the weeks tab, and with only a fixed 300ms between
        // iterations the next click could land while the previous menu was
        // still closing — which toggles the freshly opened menu shut, so the
        // item never appears and the whole beforeEach burns its 60s budget.
        const addWeekItem = page.getByRole("menuitem", {
            name: "הוספת שבוע לסוף הקורס",
        });
        await expect(addWeekItem).toBeVisible({ timeout: 15_000 });
        await addWeekItem.click();

        // And wait for it to actually close before the next iteration.
        await expect(page.getByRole("menu")).toHaveCount(0, {
            timeout: 15_000,
        });
    }
}

/**
 * Creates a syllabus and a module (via the "create module" action, which also
 * seeds two default events: a lecture "הרצאת מבוא" and an exercise 'ע"ע', and
 * opens the module dialog). Returns the lecture event's title for lookup.
 */
export async function createModuleWithEvents(page: Page): Promise<string> {
    await page.getByRole("tab", { name: "סילבוסים" }).click();

    await createSyllabusViaUi(page, `e2e-syllabus-${Date.now()}`);
    // The new syllabus opens in its dialog (#758); close it to reach the card.
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 10_000 });
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 10_000 });
    await expectNoOpenModal(page, 10_000);

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

/**
 * Expands the module row created by `createModuleWithEvents` on the "רצף זמן"
 * timeline so its event rows render, then locates the event's row by its label
 * text.
 *
 * Curricula now seed a default "הפסקות" (breaks) module alongside the one this
 * test creates, so the module-row locator must exclude it to stay unambiguous.
 */
export async function getTimelineEventRow(
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
        // Module rows start collapsed; the toggle is a button named
        // "הרחבת <module>" (#816).
        await moduleRow.getByRole("button", { name: /^הרחבת / }).click();
    }

    return eventRow;
}

/** Drags the row's staged/anchor block by a few px within its own cell, to trigger a map-to-day drop. */
export async function dragBlockWithinItsCell(page: Page, block: Locator): Promise<void> {
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
