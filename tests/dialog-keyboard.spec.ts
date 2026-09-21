import {
    test,
    expect,
    SELECTORS,
    openSettingsDialog,
    gotoAppHome,
    selectCalendarTimeRange,
    testId,
} from "./fixtures";

/**
 * Dialog focus and keyboard behaviour (#402).
 *
 * These assertions are the standing proof of the checklist: Esc closes, focus
 * is trapped, focus returns to the trigger, the first meaningful field takes
 * focus on open, and every dialog is operable keyboard-only. MUI provides most
 * of this by default — which is exactly why it needs a test: a stray
 * `disableRestoreFocus` or `disableEnforceFocus` would silently remove it.
 */
test.describe("Dialog keyboard behaviour", () => {
    test.describe.configure({ timeout: 60_000 });

    test.beforeEach(async ({ page }) => {
        await gotoAppHome(page);
    });

    test("settings dialog traps focus and restores it to the trigger", async ({
        page,
    }) => {
        const settingsButton = page.locator(
            `${SELECTORS.appBar} button.hover-rotate-subtle`,
        );

        await openSettingsDialog(page);
        const dialog = page.getByRole("dialog").filter({ hasText: "הגדרות" });

        // Trap: tabbing repeatedly must never land outside the dialog.
        for (let i = 0; i < 15; i++) {
            await page.keyboard.press("Tab");
            const insideDialog = await dialog.evaluate(
                (node) => node.contains(document.activeElement),
            );
            expect(insideDialog).toBe(true);
        }

        await page.keyboard.press("Escape");
        await expect(dialog).not.toBeVisible();

        // Restore: the gear that opened it gets focus back.
        await expect(settingsButton).toBeFocused();
    });

    test("settings tabs are reachable and activatable by keyboard alone", async ({
        page,
    }) => {
        await openSettingsDialog(page);
        const dialog = page.getByRole("dialog").filter({ hasText: "הגדרות" });

        const timeTab = dialog.getByRole("button", { name: "העדפות זמן" });
        await timeTab.focus();
        await page.keyboard.press("Enter");

        // exact: the tab's own description starts with the same words.
        await expect(
            dialog.getByText("זמני תפילות", { exact: true }),
        ).toBeVisible();
    });

    test("event dialog focuses the name field and closes on Escape", async ({
        page,
    }) => {
        await selectCalendarTimeRange(page);

        const dialog = page.getByRole("dialog").filter({ hasText: "עריכת מופע" });
        await expect(dialog).toBeVisible();

        // The first meaningful field, not the close or delete action.
        await expect(dialog.getByLabel("שם")).toBeFocused();

        await page.keyboard.press("Escape");
        await expect(dialog).not.toBeVisible();
    });

    test("event dialog is fillable and submittable keyboard-only", async ({
        page,
    }) => {
        await selectCalendarTimeRange(page);

        const dialog = page.getByRole("dialog").filter({ hasText: "עריכת מופע" });
        await expect(dialog).toBeVisible();

        await page.keyboard.type("מופע מקלדת");
        await expect(dialog.getByLabel("שם")).toHaveValue("מופע מקלדת");

        const save = dialog.getByRole("button", { name: "שמירה" });
        await expect(save).toBeEnabled();

        await save.focus();
        await page.keyboard.press("Enter");
        await expect(dialog).not.toBeVisible();
    });
    test("event dialog traps focus and restores it to the event that opened it", async ({
        page,
    }) => {
        // Opened from an existing event rather than a slot drag, because
        // "focus returns to the trigger" only means something when the trigger
        // is a real element.
        const eventName = `מיקוד ${testId("focus")}`;
        await selectCalendarTimeRange(page);
        const created = page.getByRole("dialog").filter({ hasText: "עריכת מופע" });
        await page.keyboard.type(eventName);
        await created.getByRole("button", { name: "שמירה" }).click();
        await expect(created).not.toBeVisible();

        const chip = page.locator(SELECTORS.calendarEvent).filter({
            hasText: eventName,
        }).first();
        await chip.dblclick();

        const dialog = page.getByRole("dialog").filter({ hasText: "עריכת מופע" });
        await expect(dialog).toBeVisible();

        for (let i = 0; i < 15; i++) {
            await page.keyboard.press("Tab");
            const insideDialog = await dialog.evaluate((node) =>
                node.contains(document.activeElement),
            );
            expect(insideDialog).toBe(true);
        }

        await page.keyboard.press("Escape");
        await expect(dialog).not.toBeVisible();

        // Focus must land back inside the calendar, on the event just edited —
        // not on document.body, which is where a broken restore leaves it and
        // which makes the next Tab start from the top of the page.
        const restoredToEvent = await page.evaluate(
            () => document.activeElement !== document.body,
        );
        expect(restoredToEvent).toBe(true);
    });

    test("the colour picker opens inside the dialog without closing it", async ({
        page,
    }) => {
        // The issue calls this case out: a portalled popover plus
        // ClickAwayListener has already caused unpredictable closing in the
        // header filter panel, and a nested one that dismisses its parent
        // dialog would lose the user's edits.
        await selectCalendarTimeRange(page);
        const dialog = page.getByRole("dialog").filter({ hasText: "עריכת מופע" });

        // By role name, now that the label is linked (#643). Not getByLabel:
        // MUI puts a hidden native input beside the combobox, and clicking
        // that does not open the menu.
        await dialog.getByRole("combobox", { name: "צבע" }).click();
        const swatches = page.getByRole("listbox");
        await expect(swatches).toBeVisible();

        // Escape dismisses the nested popover only.
        await page.keyboard.press("Escape");
        await expect(swatches).not.toBeVisible();
        await expect(dialog).toBeVisible();

        // And focus is still inside the dialog, not lost to the body.
        const insideDialog = await dialog.evaluate((node) =>
            node.contains(document.activeElement),
        );
        expect(insideDialog).toBe(true);
    });

    test("tab order follows the RTL visual order", async ({ page }) => {
        // In a right-to-left layout the eye moves right to left, and tab order
        // has to agree: DOM order is what drives focus, so a field appended in
        // source order but placed on the left visually would make the keyboard
        // path jump backwards across the row.
        await selectCalendarTimeRange(page);
        const dialog = page.getByRole("dialog").filter({ hasText: "עריכת מופע" });
        await expect(dialog).toBeVisible();

        const positions: Array<{ x: number; y: number }> = [];
        for (let i = 0; i < 6; i++) {
            const box = await page.evaluate(() => {
                const el = document.activeElement as HTMLElement | null;
                if (!el) return null;
                const rect = el.getBoundingClientRect();
                return { x: rect.right, y: rect.top };
            });
            if (box) positions.push(box);
            await page.keyboard.press("Tab");
        }

        // Compare only stops that share a visual row; a row break legitimately
        // moves focus back to the right edge.
        const sameRow = positions.filter(
            (p, i) => i > 0 && Math.abs(p.y - positions[i - 1].y) < 8,
        );
        for (const [i, position] of sameRow.entries()) {
            const previous = positions[positions.indexOf(position) - 1];
            expect(
                position.x,
                `tab stop ${i} moved rightwards, against the RTL reading order`,
            ).toBeLessThanOrEqual(previous.x + 1);
        }
    });
});
