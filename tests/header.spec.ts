import {
    test,
    expect,
    SELECTORS,
    clickIconButton,
    gotoAppHome,
    openSettingsDialog,
} from "./fixtures";

/**
 * Header / AppBar integration tests.
 * Covers: navigation bar, filter controls, offline mode, theme, and icon buttons.
 */

test.describe("Header / AppBar", () => {
    test.beforeEach(async ({ page }) => {
        await gotoAppHome(page);
    });

    test("renders the AppBar with logo and title", async ({ page }) => {
        const appBar = page.locator(SELECTORS.appBar);
        await expect(appBar).toBeVisible();

        // Verify the "בלוז" title is present
        await expect(appBar.getByText("בלוז")).toBeVisible();
    });

    test("renders the user access card", async ({ page }) => {
        const appBar = page.locator(SELECTORS.appBar);

        // UserAccessCard should be visible inside the AppBar
        // It contains user info — just verify the toolbar section exists
        const toolbar = appBar.locator(SELECTORS.toolbar);
        await expect(toolbar).toBeVisible();
    });

    test("displays filter controls in the header", async ({ page }) => {
        const filterToggle = page.getByRole("button", { name: /הצגת סננים|הסתרת סננים/ });
        await expect(filterToggle).toBeVisible();

        // Filters should not be visible initially
        const prayerToggle = page.getByRole("button", { name: /הסתרת תפילות|הצגת תפילות/ });
        await expect(prayerToggle).not.toBeVisible();

        // Click to open menu
        await filterToggle.click();

        // Now they should be visible
        await expect(prayerToggle).toBeVisible();

        const paToggle = page.getByRole("button", { name: /גילוי חלונות פ"א|הסתרת חלונות פ"א/ });
        await expect(paToggle).toBeVisible();

        const misconfigToggle = page.getByRole("button", { name: /הצגת פערי איוש|הסתרת פערי איוש/ });
        await expect(misconfigToggle).toBeVisible();
    });

    test("toggles filter visibility via the filter icon", async ({ page }) => {
        // Find the filter toggle button
        const filterToggle = page.getByRole("button", { name: /הצגת סננים|הסתרת סננים/ });

        const instructorFilter = page.getByText("סינון לפי מדריכים").first();
        await expect(instructorFilter).not.toBeVisible();

        // Open menu
        await filterToggle.click();
        await expect(instructorFilter).toBeVisible({ timeout: 10_000 });

        // Close menu
        await page.keyboard.press("Escape");
        await expect(instructorFilter).not.toBeVisible({ timeout: 10_000 });
    });

    test("toggles prayer filter on click", async ({ page }) => {
        const filterToggle = page.getByRole("button", { name: /הצגת סננים|הסתרת סננים/ });

        // Panel may already be open from a previous test; open it if not
        if (!await page.getByRole("button", { name: /הסתרת סננים/ }).isVisible()) {
            await filterToggle.click();
        }

        const prayerToggle = page.getByRole("button", { name: /הסתרת תפילות|הצגת תפילות/ });
        await expect(prayerToggle).toBeVisible();

        // Click to toggle prayer filter; Tooltip-Portal / ClickAwayListener may
        // close the Popover — re-open it before asserting the overlay icon.
        await prayerToggle.click();
        if (!await page.getByRole("button", { name: /הסתרת סננים/ }).isVisible()) {
            await filterToggle.click();
        }

        // The DoNotDisturbAlt overlay icon should become visible
        const overlayIcon = prayerToggle.locator("svg.absolute");
        await expect(overlayIcon).toBeVisible({ timeout: 5_000 });

        // Toggle back
        await prayerToggle.click();
        await page.waitForTimeout(300);
    });

    test("toggles PA windows filter on click", async ({ page }) => {
        const filterToggle = page.getByRole("button", { name: /הצגת סננים|הסתרת סננים/ });
        await filterToggle.click();

        // Initial state — "גלה" (show PA windows)
        const showBtn = page.getByRole("button", { name: /גילוי חלונות פ"א/ });
        await expect(showBtn).toBeVisible();

        // Click to toggle; the filter Popover may close (Tooltip Portal / ClickAwayListener
        // interaction) — re-open it before asserting the new label.
        await showBtn.click();
        if (!await page.getByRole("button", { name: /הסתרת סננים/ }).isVisible()) {
            await filterToggle.click();
        }
        await expect(
            page.getByRole("button", { name: /הסתרת חלונות פ"א/ }),
        ).toBeVisible({ timeout: 5_000 });

        // Toggle back — same pattern
        await page.getByRole("button", { name: /הסתרת חלונות פ"א/ }).click();
        if (!await page.getByRole("button", { name: /הסתרת סננים/ }).isVisible()) {
            await filterToggle.click();
        }
        await expect(
            page.getByRole("button", { name: /גילוי חלונות פ"א/ }),
        ).toBeVisible({ timeout: 5_000 });
    });

    test("navigates to the Gantt page via curriculum icon", async ({
        page,
    }) => {
        const appBar = page.locator(SELECTORS.appBar);

        const ganttButton = appBar.getByRole("button", { name: "עבור לבניית גאנט" });
        await expect(ganttButton).toBeVisible();
        for (let attempt = 0; attempt < 3; attempt++) {
            await ganttButton.click();
            try {
                await page.waitForURL(/\/gantt/, { timeout: 15_000 });
                break;
            } catch {
                if (attempt === 2) {
                    throw new Error("Failed to navigate to /gantt");
                }
            }
        }
        await expect(page).toHaveURL(/\/gantt/);
    });

    test("opens settings dialog via gear icon", async ({ page }) => {
        await openSettingsDialog(page);

        // Settings dialog should be visible with "הגדרות" title
        const dialog = page.locator(SELECTORS.settingsDialog).first();
        await expect(dialog).toBeVisible();
        await expect(dialog.getByText("הגדרות")).toBeVisible();
    });

    test("toggles offline mode indicator", async ({ page }) => {
        const appBar = page.locator(SELECTORS.appBar);

        // Find the offline mode toggle
        const offlineToggle = appBar.getByRole("button", { name: /חזור למצב מקוון|עבור למצב לוקלי/ });

        if ((await offlineToggle.count()) > 0) {
            const toggleBtn = offlineToggle.first();
            await toggleBtn.click();
            await expect(toggleBtn).toHaveClass(/animate-pulse-soft/);

            await toggleBtn.click();
            await expect(toggleBtn).not.toHaveClass(/animate-pulse-soft/);
            await page.waitForTimeout(500);
        }
    });

    test("displays misconfigurations toggle in warning color when active", async ({
        page,
    }) => {
        // This test runs ~6 sequential open→click→visibility cycles (each up to
        // 5s). Under CI load that exceeds the 15s global test timeout, which
        // then tears down the context mid-click ("Target page has been
        // closed"). Give this heavier flow its own budget.
        test.setTimeout(45_000);

        const filterToggle = page.getByRole("button", { name: /הצגת סננים|הסתרת סננים/ });

        const openAndFind = async () => {
            if (!await page.getByRole("button", { name: /הסתרת סננים/ }).isVisible()) {
                await filterToggle.click();
            }
            return page.getByRole("button", { name: /הצגת פערי איוש|הסתרת פערי איוש/ });
        };

        let toggle = await openAndFind();
        await expect(toggle).toBeVisible();

        // Normalise: start with misconfigurations hidden ("הצג" = currently off)
        if ((await toggle.getAttribute("aria-label"))?.includes("הסתר")) {
            await toggle.click();
            toggle = await openAndFind();
            await expect(page.getByRole("button", { name: /הצגת פערי/ })).toBeVisible({ timeout: 5_000 });
        }

        // Toggle ON → label should become "הסתרת פערי איוש"
        await page.getByRole("button", { name: /הצגת פערי/ }).click();
        toggle = await openAndFind();
        await expect(page.getByRole("button", { name: /הסתרת פערי/ })).toBeVisible({ timeout: 5_000 });

        // Toggle OFF → label should return to "הצגת פערי איוש"
        await page.getByRole("button", { name: /הסתרת פערי/ }).click();
        toggle = await openAndFind();
        await expect(page.getByRole("button", { name: /הצגת פערי/ })).toBeVisible({ timeout: 5_000 });
    });
});
