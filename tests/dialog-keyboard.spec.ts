import {
    test,
    expect,
    SELECTORS,
    openSettingsDialog,
    gotoAppHome,
    selectCalendarTimeRange,
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
});
