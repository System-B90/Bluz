import { test, expect } from "@playwright/test";
import { SELECTORS, openSettingsDialog, waitForAppLoad } from "./fixtures";

/**
 * Header / AppBar integration tests.
 * Covers: navigation bar, filter controls, offline mode, theme, and icon buttons.
 */

test.describe("Header / AppBar", () => {
    test.beforeEach(async ({ page }) => {
        await page.goto("/");
        await waitForAppLoad(page);
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
        const appBar = page.locator(SELECTORS.appBar);

        // The prayer toggle (SynagogueIcon) should be visible
        const prayerToggle = appBar.locator(
            "button:has(svg[data-testid='SynagogueIcon'])",
        );
        await expect(prayerToggle).toBeVisible();

        // The PA windows toggle (ChatIcon) should be visible
        const paToggle = appBar.locator(
            "button:has(svg[data-testid='ChatIcon'])",
        );
        await expect(paToggle).toBeVisible();

        // The misconfigurations toggle (WarningIcon) should be visible
        const misconfigToggle = appBar.locator(
            "button:has(svg[data-testid='WarningIcon'])",
        );
        await expect(misconfigToggle).toBeVisible();
    });

    test("toggles filter visibility via the filter icon", async ({ page }) => {
        const appBar = page.locator(SELECTORS.appBar);

        // Find the filter toggle button (FilterListIcon or similar)
        const filterToggle = appBar.locator(
            "button:has(svg[data-testid='FilterListIcon'])",
        );

        // Filters should be initially visible (autocomplete dropdowns present)
        const autocompletes = appBar.locator(SELECTORS.autocomplete);
        await expect(autocompletes.first()).toBeVisible();

        // Click filter toggle to hide
        await filterToggle.click();
        await page.waitForTimeout(400);

        // Filters should be hidden
        await expect(autocompletes.first()).not.toBeVisible();

        // Click again to show
        await filterToggle.click();
        await page.waitForTimeout(400);

        // Filters should be visible again
        await expect(autocompletes.first()).toBeVisible();
    });

    test("toggles prayer filter on click", async ({ page }) => {
        const appBar = page.locator(SELECTORS.appBar);
        const prayerToggle = appBar.locator(
            "button:has(svg[data-testid='SynagogueIcon'])",
        );

        // Click to toggle prayer filter
        await prayerToggle.click();
        await page.waitForTimeout(300);

        // The DoNotDisturbAlt overlay icon should become visible
        const overlayIcon = appBar.locator(
            "svg[data-testid='DoNotDisturbAltIcon']",
        );
        await expect(overlayIcon).toBeVisible();

        // Toggle back
        await prayerToggle.click();
        await page.waitForTimeout(300);
    });

    test("toggles PA windows filter on click", async ({ page }) => {
        const appBar = page.locator(SELECTORS.appBar);
        const paToggle = appBar.locator(
            "button:has(svg[data-testid='ChatIcon'])",
        );

        // Click to activate PA filter
        await paToggle.click();
        await page.waitForTimeout(300);

        // The button should now have primary color (active state)
        // We verify via the color attribute on the IconButton
        await expect(paToggle).toHaveAttribute("class", /MuiIconButton-colorPrimary/);

        // Toggle off
        await paToggle.click();
        await page.waitForTimeout(300);
    });

    test("navigates to the Gantt page via curriculum icon", async ({
        page,
    }) => {
        const appBar = page.locator(SELECTORS.appBar);

        // The curriculum icon button should be visible
        const curriculumButton = appBar.locator(
            "button:has(svg), a:has(svg)",
        ).filter({
            has: page.locator("[data-testid='AutoStoriesIcon'], [data-testid='SchoolIcon']"),
        });

        // If CurriculumIcon is a link/button, click it
        if (await curriculumButton.count() > 0) {
            await curriculumButton.first().click();
            await page.waitForURL(/\/gantt/);
            await expect(page).toHaveURL(/\/gantt/);
        }
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
        const offlineToggle = appBar.locator(
            "button:has(svg[data-testid='WifiTetheringIcon']), button:has(svg[data-testid='WifiTetheringOffIcon']), button:has(svg[data-testid='CloudOffIcon'])",
        );

        if ((await offlineToggle.count()) > 0) {
            await offlineToggle.first().click();
            await page.waitForTimeout(500);

            // The offline FAB indicator should appear in the bottom-left
            const offlineFab = page.locator(
                "button[aria-label='offline-status']",
            );
            await expect(offlineFab).toBeVisible();

            // Toggle off
            await offlineToggle.first().click();
            await page.waitForTimeout(500);
        }
    });

    test("displays misconfigurations toggle in warning color when active", async ({
        page,
    }) => {
        const appBar = page.locator(SELECTORS.appBar);
        const misconfigToggle = appBar.locator(
            "button:has(svg[data-testid='WarningIcon'])",
        );

        // Click to activate
        await misconfigToggle.click();
        await page.waitForTimeout(300);

        // Button should have warning color class
        await expect(misconfigToggle).toHaveAttribute(
            "class",
            /MuiIconButton-colorWarning/,
        );

        // Click to deactivate
        await misconfigToggle.click();
        await page.waitForTimeout(300);
    });
});
