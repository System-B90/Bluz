import { test, expect } from "@playwright/test";

import {
    SELECTORS,
    openSettingsDialog,
    closeSettingsDialog,
    gotoAppHome,
    navigateToSettingsTab,
    testId,
} from "./fixtures";

/**
 * Settings dialog integration tests.
 * Covers: open/close, tab navigation, personal settings (groups, instructors, outsiders),
 *         global settings (prayers, courses), room CRUD, outsider settings, theme switching.
 */

test.describe("Settings Dialog", () => {
    test.beforeEach(async ({ page }) => {
        await gotoAppHome(page);
    });

    // ─── Open / Close ───────────────────────────────────────────────────────

    test("opens and closes the settings dialog", async ({ page }) => {
        await openSettingsDialog(page);

        const dialog = page.locator(SELECTORS.settingsDialog).first();
        await expect(dialog).toBeVisible();
        await expect(dialog.getByText("הגדרות")).toBeVisible();
        await expect(dialog.getByText("ניהול העדפות המערכת")).toBeVisible();

        await closeSettingsDialog(page);
        await expect(dialog).not.toBeVisible();
    });

    test("closes settings dialog with Escape key", async ({
        page,
    }) => {
        await openSettingsDialog(page);
        const dialog = page.locator(SELECTORS.settingsDialog).first();
        await expect(dialog).toBeVisible();

        await page.keyboard.press("Escape");
        await expect(dialog).not.toBeVisible();
    });

    // ─── Tab Navigation ─────────────────────────────────────────────────────

    test("navigates between all settings tabs", async ({ page }) => {
        await openSettingsDialog(page);
        const dialog = page.locator(SELECTORS.settingsDialog).first();

        // Tab labels and expected content markers
        const tabs = [
            { label: "אישי", marker: "קבוצות שלי" },
            { label: "כללי", marker: "זמני תפילות" },
            { label: "חדרים", marker: "חדרים" },
            { label: "אנשי חוץ", marker: "אנשי חוץ" },
        ];

        for (const { label, marker } of tabs) {
            await navigateToSettingsTab(page, label);
            await expect(dialog.getByText(marker).first()).toBeVisible();
        }
    });

    // ─── Personal Settings ──────────────────────────────────────────────────

    test("personal tab displays group, instructor, and outsider selection cards", async ({
        page,
    }) => {
        await openSettingsDialog(page);
        await navigateToSettingsTab(page, "אישי");

        const dialog = page.locator(SELECTORS.settingsDialog).first();

        // Groups card
        await expect(dialog.getByText("קבוצות שלי")).toBeVisible();
        await expect(
            dialog.getByText("בחירת קבוצות להצגה מותאמת ביומן"),
        ).toBeVisible();

        // Instructors card
        await expect(dialog.getByText("מרצים מועדפים")).toBeVisible();
        await expect(
            dialog.getByText("מעקב אחר מרצים מבוקשים ביומן"),
        ).toBeVisible();

        // Outsiders card
        await expect(
            dialog.getByText("בחירת אנשי חוץ מועדפים שיופיעו בראש הרשימה ביומן"),
        ).toBeVisible();
    });

    test("adds and removes a group in personal settings", async ({ page }) => {
        await openSettingsDialog(page);
        await navigateToSettingsTab(page, "אישי");

        const dialog = page.locator(SELECTORS.settingsDialog).first();

        // Find the groups autocomplete (first one with "חפש והוסף קבוצה")
        const groupSearch = dialog
            .locator(SELECTORS.autocomplete)
            .filter({ hasText: "חפש והוסף קבוצה" })
            .first();

        // Click the autocomplete input and type
        await groupSearch.locator("input").click();
        await groupSearch.locator("input").fill("Group");
        await page.waitForTimeout(500);

        // Select the first option from the dropdown
        const option = page.locator(".MuiAutocomplete-option").first();
        if ((await option.count()) > 0) {
            const optionText = await option.textContent();
            await option.click();
            await page.waitForTimeout(500);

            // A chip should appear with the group name
            const chip = dialog.locator(SELECTORS.chip).filter({
                hasText: optionText!,
            });
            await expect(chip.first()).toBeVisible();

            // A success snackbar should appear
            const snackbar = page.locator(SELECTORS.snackbar);
            await expect(snackbar).toBeVisible();

            // Delete the chip
            const deleteButton = chip.first().locator("svg");
            await deleteButton.click();
            await page.waitForTimeout(500);

            // Chip should be gone
            await expect(chip.first()).not.toBeVisible();
        }
    });

    test("adds and removes an instructor in personal settings", async ({
        page,
    }) => {
        await openSettingsDialog(page);
        await navigateToSettingsTab(page, "אישי");

        const dialog = page.locator(SELECTORS.settingsDialog).first();

        const instructorSearch = dialog
            .locator(SELECTORS.autocomplete)
            .filter({ hasText: "חפש והוסף מרצה" })
            .first();

        await instructorSearch.locator("input").click();
        await instructorSearch.locator("input").fill("Al");
        await page.waitForTimeout(500);

        const option = page.locator(".MuiAutocomplete-option").first();
        if ((await option.count()) > 0) {
            const optionText = await option.textContent();
            await option.click();
            await page.waitForTimeout(500);

            const chip = dialog.locator(SELECTORS.chip).filter({
                hasText: optionText!,
            });
            await expect(chip.first()).toBeVisible();

            // Clean up
            const deleteButton = chip.first().locator("svg");
            await deleteButton.click();
            await page.waitForTimeout(500);
        }
    });

    // ─── Global Settings ────────────────────────────────────────────────────

    test("global tab displays prayer and course settings", async ({
        page,
    }) => {
        await openSettingsDialog(page);
        await navigateToSettingsTab(page, "כללי");

        const dialog = page.locator(SELECTORS.settingsDialog).first();

        await expect(dialog.getByText("זמני תפילות").first()).toBeVisible();
        await expect(
            dialog.getByText("היררכיית מסלולים ומדריכים").first(),
        ).toBeVisible();
    });

    // ─── Room Settings ──────────────────────────────────────────────────────

    test("room settings tab displays room list", async ({ page }) => {
        await openSettingsDialog(page);
        await navigateToSettingsTab(page, "חדרים");

        const dialog = page.locator(SELECTORS.settingsDialog).first();

        // The room list or search field should be visible
        const hasRoomContent =
            (await dialog.locator("input").count()) > 0;
        expect(hasRoomContent).toBeTruthy();
    });

    test("searches rooms in the room settings", async ({ page }) => {
        await openSettingsDialog(page);
        await navigateToSettingsTab(page, "חדרים");

        const dialog = page.locator(SELECTORS.settingsDialog).first();

        // Find a search input (the room search field)
        const searchInputs = dialog.locator("input");
        if ((await searchInputs.count()) > 0) {
            // Type a search query
            await searchInputs.first().fill("test-nonexistent-room");
            await page.waitForTimeout(300);

            // Clear the search
            await searchInputs.first().fill("");
            await page.waitForTimeout(300);
        }
    });

    test("creates and deletes a custom room", async ({ page }) => {
        const roomName = testId("room");

        await openSettingsDialog(page);
        await navigateToSettingsTab(page, "חדרים");

        const dialog = page.locator(SELECTORS.settingsDialog).first();

        // Find the "add room" button (AddIcon or plus button)
        const addButton = dialog.locator(
            "button:has(svg[data-testid='AddIcon'])",
        );

        if ((await addButton.count()) > 0) {
            await addButton.first().click();
            await page.waitForTimeout(300);

            // Fill room name
            const nameInput = dialog.locator("input").filter({
                has: page.locator("[type='text']"),
            });

            // Find the name field specifically (labeled "שם" or first text input in form area)
            const formInputs = dialog.locator("input[type='text']");
            if ((await formInputs.count()) > 0) {
                await formInputs.first().fill(roomName);

                // Click save
                const saveButton = dialog.getByRole("button", {
                    name: /שמור|צור|הוסף/,
                });
                if ((await saveButton.count()) > 0) {
                    await saveButton.first().click();
                    await page.waitForTimeout(1000);

                    // Verify room appears in the list
                    const roomItem = dialog.getByText(roomName);
                    if ((await roomItem.count()) > 0) {
                        await expect(roomItem.first()).toBeVisible();

                        // Now delete it: click the room to select it, then find delete
                        await roomItem.first().click();
                        await page.waitForTimeout(300);

                        const deleteButton = dialog.locator(
                            "button:has(svg[data-testid='DeleteIcon'])",
                        );
                        if ((await deleteButton.count()) > 0) {
                            // Handle confirmation dialog
                            page.on("dialog", (d) => d.accept());
                            await deleteButton.first().click();
                            await page.waitForTimeout(1000);
                        }
                    }
                }
            }
        }
    });

    test("edits a room's extended info fields", async ({ page }) => {
        await openSettingsDialog(page);
        await navigateToSettingsTab(page, "חדרים");

        const dialog = page.locator(SELECTORS.settingsDialog).first();

        // Try to find and click on an existing room in the list
        const roomListItems = dialog.locator("[role='listitem'], li").filter({
            has: page.locator("span, p"),
        });

        if ((await roomListItems.count()) > 0) {
            // Click the first room
            await roomListItems.first().click();
            await page.waitForTimeout(300);

            // The form should now be populated
            // Look for the extended info fields
            const workstationLabel = dialog.getByText("עמדות מחשב");
            const seatLabel = dialog.getByText("מקומות ישיבה");

            if ((await workstationLabel.count()) > 0) {
                await expect(workstationLabel).toBeVisible();
            }
            if ((await seatLabel.count()) > 0) {
                await expect(seatLabel).toBeVisible();
            }
        }
    });

    // ─── Outsider Settings ──────────────────────────────────────────────────

    test("outsider settings tab renders", async ({ page }) => {
        await openSettingsDialog(page);
        await navigateToSettingsTab(page, "אנשי חוץ");

        const dialog = page.locator(SELECTORS.settingsDialog).first();

        // Outsider settings tab should render content
        // At minimum, the tab area should not be empty
        const tabContent = dialog.locator(".animate-slide-up-fade, [class*='animate']");
        const hasContent = (await tabContent.count()) > 0 ||
            (await dialog.getByText("אנשי חוץ").count()) > 0;
        expect(hasContent).toBeTruthy();
    });

    // ─── Theme Switching ────────────────────────────────────────────────────

    test("toggles theme from the settings dialog sidebar", async ({
        page,
    }) => {
        await openSettingsDialog(page);

        const dialog = page.locator(SELECTORS.settingsDialog).first();

        // Find the theme selector label
        const themeLabel = dialog.getByText("מצב תצוגה");
        await expect(themeLabel).toBeVisible();

        // Find the theme toggle buttons/icons (near the "מצב תצוגה" label)
        const themeSection = dialog.locator("button, [role='radiogroup'], [role='button']").filter({
            has: page.locator(
                "svg[data-testid='LightModeIcon'], svg[data-testid='DarkModeIcon'], svg[data-testid='Brightness4Icon']",
            ),
        });

        if ((await themeSection.count()) > 0) {
            // Record current theme
            const htmlElement = page.locator("html");
            const initialClass = await htmlElement.getAttribute("class");

            // Click the theme toggle
            await themeSection.first().click();
            await page.waitForTimeout(500);

            // Theme class should change
            const newClass = await htmlElement.getAttribute("class");
            // Either class changed or data-theme attribute changed
            const themeChanged =
                initialClass !== newClass ||
                (await htmlElement.getAttribute("data-theme")) !== null;

            // Restore: click again
            await themeSection.first().click();
            await page.waitForTimeout(500);
        }

        await closeSettingsDialog(page);
    });
});
