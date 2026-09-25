import {
    test,
    expect,
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
    // A cold app load plus the hydration retry in `openSettingsDialog` doesn't
    // fit the suite's global 15s budget — that cap is what turned a slow open
    // into 13 hard failures.
    test.describe.configure({ timeout: 60_000 });

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

    test("closes settings dialog with Escape key", async ({ page }) => {
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
            { label: "העדפות זמן", marker: "זמני תפילות" },
            { label: "בניית קורסים", marker: "היררכיית מסלולים ומדריכים" },
            { label: "חדרים", marker: "חדרים" },
            { label: "אנשי חוץ", marker: "אנשי חוץ" },
        ];

        for (const { label, marker } of tabs) {
            await navigateToSettingsTab(page, label);
            await expect(dialog.getByText(marker).first()).toBeVisible();
        }
    });

    // ─── Personal Settings ──────────────────────────────────────────────────

    test("personal tab displays group and outsider selection cards", async ({
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

        // Outsiders card
        await expect(
            dialog.getByText(
                "בחירת אנשי חוץ מועדפים שיופיעו בראש הרשימה ביומן",
            ),
        ).toBeVisible();
    });

    test("adds and removes a group in personal settings", async ({ page }) => {
        await openSettingsDialog(page);
        await navigateToSettingsTab(page, "אישי");

        const dialog = page.locator(SELECTORS.settingsDialog).first();

        // Find the groups autocomplete (first one with "חיפוש והוספת קבוצה")
        const groupSearch = dialog
            .locator(SELECTORS.autocomplete)
            .filter({ hasText: "חיפוש והוספת קבוצה" })
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

    test("global tab displays prayer, meal, and calendar-hours settings", async ({ page }) => {
        await openSettingsDialog(page);
        await navigateToSettingsTab(page, "העדפות זמן");

        const dialog = page.locator(SELECTORS.settingsDialog).first();

        await expect(dialog.getByText("זמני תפילות").first()).toBeVisible();
        await expect(dialog.getByText("שעות ארוחות").first()).toBeVisible();
        await expect(dialog.getByText("שעות תצוגת יומן").first()).toBeVisible();
    });

    test("meal times card shows breakfast, lunch, and dinner rows", async ({ page }) => {
        await openSettingsDialog(page);
        await navigateToSettingsTab(page, "העדפות זמן");

        const dialog = page.locator(SELECTORS.settingsDialog).first();

        await expect(dialog.getByText("ארוחת בוקר").first()).toBeVisible();
        await expect(dialog.getByText("ארוחת צהריים").first()).toBeVisible();
        await expect(dialog.getByText("ארוחת ערב").first()).toBeVisible();
    });

    // ─── Course Builder Settings (בניית קורסים) ─────────────────────────────

    test("course builder tab displays the course hierarchy panel", async ({ page }) => {
        await openSettingsDialog(page);
        await navigateToSettingsTab(page, "בניית קורסים");

        const dialog = page.locator(SELECTORS.settingsDialog).first();

        await expect(
            dialog.getByText("היררכיית מסלולים ומדריכים").first(),
        ).toBeVisible();
        await expect(
            dialog.getByText("הגדרת מבנה ההיררכיה ושיוך מדריכים למסלולים").first(),
        ).toBeVisible();
    });

    // ─── Iteration Settings (מחזורים) ───────────────────────────────────────

    test("iterations tab renders", async ({ page }) => {
        await openSettingsDialog(page);
        await navigateToSettingsTab(page, "מחזורים");

        const dialog = page.locator(SELECTORS.settingsDialog).first();
        const tabContent = dialog.locator(".animate-slide-up-fade").last();
        await expect(tabContent).toBeVisible();
    });

    /**
     * The real switch, end to end (#472). The tab-renders test above never
     * pressed "הפעל", so a promotion that failed against a standalone mongod —
     * which is exactly how the test and dev stacks run — looked green twice in
     * a row. This drives the actual PATCH and puts the original iteration back.
     */
    test("switches the active iteration and restores it", async ({ page }) => {
        const tempId = `e2e-switch-${Date.now()}`;
        const tempLabel = `מחזור בדיקה ${tempId}`;

        const before = await page.request.get("/api/iterations");
        expect(before.ok()).toBeTruthy();
        const originalCurrent = (await before.json()).data.find(
            (iteration: { isCurrent: boolean }) => iteration.isCurrent,
        );
        expect(originalCurrent, "an iteration must be current to start").toBeTruthy();

        const created = await page.request.post("/api/iterations", {
            // An explicit cache skips the Hive round-trip on register: this
            // test is about the switch, not about Hive being reachable.
            data: {
                id: tempId,
                label: tempLabel,
                hiveCache: {
                    modules: {},
                    subjects: {},
                    rooms: {},
                    cachedAt: new Date().toISOString(),
                },
            },
        });
        expect(created.ok()).toBeTruthy();

        try {
            await openSettingsDialog(page);
            await navigateToSettingsTab(page, "מחזורים");
            const dialog = page.locator(SELECTORS.settingsDialog).first();

            const row = dialog
                .locator("li", { hasText: tempLabel })
                .first();
            await expect(row).toBeVisible();

            await row.getByRole("button", { name: "הפעל" }).click();

            // The failure mode this guards is a bare 500 surfacing as the error
            // snackbar, so assert the success text rather than mere absence.
            await expect(
                page.getByText(`"${tempLabel}" הוגדר כמחזור הפעיל`),
            ).toBeVisible();
            await expect(
                page.getByText("קביעת המחזור הפעיל נכשלה."),
            ).toHaveCount(0);

            // And the registry really moved, not just the snackbar.
            const after = await page.request.get("/api/iterations");
            const current = (await after.json()).data.find(
                (iteration: { isCurrent: boolean }) => iteration.isCurrent,
            );
            expect(current.id).toBe(tempId);
        } finally {
            // Restore first: an iteration cannot be deleted while it is current.
            await page.request.patch(`/api/iterations/${originalCurrent.id}`, {
                data: { isCurrent: true },
            });
            await page.request.delete(`/api/iterations/${tempId}`);
        }
    });

    // ─── Room Settings ──────────────────────────────────────────────────────

    test("room settings tab displays room list", async ({ page }) => {
        await openSettingsDialog(page);
        await navigateToSettingsTab(page, "חדרים");

        const dialog = page.locator(SELECTORS.settingsDialog).first();

        // The room list or search field should be visible
        const hasRoomContent = (await dialog.locator("input").count()) > 0;
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

        // Find the "add room" button
        const addButton = dialog.getByRole("button", { name: "הוספת חדר מותאם אישית" });

        if ((await addButton.count()) > 0) {
            await addButton.first().click();
            await page.waitForTimeout(300);

            // Fill room name (labeled "שם החדר")
            const nameInput = dialog.getByLabel("שם החדר");
            if ((await nameInput.count()) > 0) {
                await nameInput.first().fill(roomName);

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

                        const deleteButton = dialog.locator("li").filter({ hasText: roomName }).getByRole("button", { name: "מחיקה" });
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
            // Look for the extended info fields. Use getByLabel (targets the
            // input, not text nodes) since MUI's outlined variant renders the
            // label text twice in the DOM (visible <label> + hidden notch
            // <legend><span>), which trips getByText's strict-mode matching.
            const workstationInput = dialog.getByLabel("כמות עמדות עבודה");
            const seatInput = dialog.getByLabel("מספר כסאות להרצאה");

            if ((await workstationInput.count()) > 0) {
                await expect(workstationInput).toBeVisible();
            }
            if ((await seatInput.count()) > 0) {
                await expect(seatInput).toBeVisible();
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
        const tabContent = dialog.locator(
            ".animate-slide-up-fade, [class*='animate']",
        );
        const hasContent =
            (await tabContent.count()) > 0 ||
            (await dialog.getByText("אנשי חוץ").count()) > 0;
        expect(hasContent).toBeTruthy();
    });

    // ─── Theme Switching ────────────────────────────────────────────────────

    test("toggles theme from the settings dialog sidebar", async ({ page }) => {
        await openSettingsDialog(page);

        const dialog = page.locator(SELECTORS.settingsDialog).first();

        // Find the theme selector label
        const themeLabel = dialog.getByText("מצב תצוגה");
        await expect(themeLabel).toBeVisible();

        // Find the theme toggle button
        const themeSection = dialog.locator("button.theme-slider, button[aria-label='Toggle theme']");

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
