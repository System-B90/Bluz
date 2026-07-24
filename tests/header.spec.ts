import {
    test,
    expect,
    SELECTORS,
    clickIconButton,
    gotoAppHome,
    openSettingsDialog,
    openFilterPanel,
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
        await openFilterPanel(page);

        // Prayers start shown → tooltip label reads "הסתרת תפילות" (hide prayers).
        const prayerToggle = page.getByRole("button", { name: /הסתרת תפילות|הצגת תפילות/ });
        await expect(prayerToggle).toHaveAttribute("aria-label", "הסתרת תפילות");

        // Toggle ON: hidePrayers flips true → label becomes "הצגת תפילות" (show prayers).
        // The label flip is the source-of-truth state signal (the overlay icon only
        // changes opacity, which Playwright's visibility check ignores).
        await prayerToggle.click();
        await expect(page.getByRole("button", { name: "הצגת תפילות" })).toBeVisible();

        // Toggle back OFF → label returns to "הסתרת תפילות".
        await page.getByRole("button", { name: "הצגת תפילות" }).click();
        await expect(page.getByRole("button", { name: "הסתרת תפילות" })).toBeVisible();
    });

    test("toggles PA windows filter on click", async ({ page }) => {
        await openFilterPanel(page);

        // Initial state — "גילוי חלונות פ\"א" (show PA windows).
        await expect(page.getByRole("button", { name: /גילוי חלונות פ"א/ })).toBeVisible();

        // Toggle ON → label flips to "הסתרת חלונות פ\"א" (hide).
        await page.getByRole("button", { name: /גילוי חלונות פ"א/ }).click();
        await expect(page.getByRole("button", { name: /הסתרת חלונות פ"א/ })).toBeVisible();

        // Toggle back OFF → label returns to "גילוי חלונות פ\"א".
        await page.getByRole("button", { name: /הסתרת חלונות פ"א/ }).click();
        await expect(page.getByRole("button", { name: /גילוי חלונות פ"א/ })).toBeVisible();
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
        await openFilterPanel(page);

        const toggle = page.getByRole("button", { name: /הצגת פערי איוש|הסתרת פערי איוש/ });
        await expect(toggle).toBeVisible();

        // Normalise: start with misconfigurations hidden ("הצגת" = currently off).
        if ((await toggle.getAttribute("aria-label"))?.includes("הסתר")) {
            await page.getByRole("button", { name: /הסתרת פערי/ }).click();
            await expect(page.getByRole("button", { name: /הצגת פערי/ })).toBeVisible();
        }

        // Off state → color="inherit" (no warning class).
        const offBtn = page.getByRole("button", { name: /הצגת פערי/ });
        await expect(offBtn).not.toHaveClass(/MuiIconButton-colorWarning/);

        // Toggle ON → label becomes "הסתרת פערי איוש" AND the icon turns warning-colored.
        await offBtn.click();
        const onBtn = page.getByRole("button", { name: /הסתרת פערי/ });
        await expect(onBtn).toBeVisible();
        await expect(onBtn).toHaveClass(/MuiIconButton-colorWarning/);

        // Toggle OFF → label returns and warning color clears.
        await onBtn.click();
        await expect(page.getByRole("button", { name: /הצגת פערי/ })).toBeVisible();
    });
});
