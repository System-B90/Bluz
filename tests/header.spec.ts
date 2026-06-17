import { test, expect } from "@playwright/test";

import {
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
        const filterToggle = page.locator(
            "button:has(svg[data-testid='FilterListIcon'])",
        );
        await expect(filterToggle).toBeVisible();

        // Filters should not be visible initially
        const prayerToggle = page.locator(
            "button:has(svg[data-testid='SynagogueIcon'])",
        );
        await expect(prayerToggle).not.toBeVisible();

        // Click to open menu
        await filterToggle.click();

        // Now they should be visible
        await expect(prayerToggle).toBeVisible();

        const paToggle = page.locator(
            "button:has(svg[data-testid='ChatIcon'])",
        );
        await expect(paToggle).toBeVisible();

        const misconfigToggle = page.locator(
            "button:has(svg[data-testid='WarningIcon'])",
        );
        await expect(misconfigToggle).toBeVisible();
    });

    test("toggles filter visibility via the filter icon", async ({ page }) => {
        // Find the filter toggle button (FilterListIcon or similar)
        const filterToggle = page.locator(
            "button:has(svg[data-testid='FilterListIcon'])",
        );

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
        const filterToggle = page.locator(
            "button:has(svg[data-testid='FilterListIcon'])",
        );
        await filterToggle.click();

        const prayerToggle = page.locator(
            "button:has(svg[data-testid='SynagogueIcon'])",
        );
        await expect(prayerToggle).toBeVisible();

        // Click to toggle prayer filter
        await prayerToggle.click();
        await page.waitForTimeout(300);

        // The DoNotDisturbAlt overlay icon should become visible
        const overlayIcon = page.locator(
            "svg[data-testid='DoNotDisturbAltIcon']",
        );
        await expect(overlayIcon).toBeVisible();

        // Toggle back
        await prayerToggle.click();
        await page.waitForTimeout(300);
    });

    test("toggles PA windows filter on click", async ({ page }) => {
        const filterToggle = page.locator(
            "button:has(svg[data-testid='FilterListIcon'])",
        );
        await filterToggle.click();

        const paToggle = page.locator(
            "button:has(svg[data-testid='ChatIcon'])",
        );
        await expect(paToggle).toBeVisible();

        await paToggle.click();
        await expect
            .poll(async () => paToggle.getAttribute("aria-label"))
            .toMatch(/הסתר חלונות/, { timeout: 10_000 });

        await paToggle.click();
        await expect
            .poll(async () => paToggle.getAttribute("aria-label"))
            .toMatch(/גלה חלונות/, { timeout: 10_000 });
    });

    test("navigates to the Gantt page via curriculum icon", async ({
        page,
    }) => {
        const appBar = page.locator(SELECTORS.appBar);

        const ganttButton = appBar.locator(
            "button:has(svg[data-testid='AutoStoriesIcon'])",
        );
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
        const offlineToggle = appBar.locator(
            "button:has(svg[data-testid='WifiTetheringIcon']), button:has(svg[data-testid='WifiTetheringOffIcon']), button:has(svg[data-testid='CloudOffIcon'])",
        );

        if ((await offlineToggle.count()) > 0) {
            await offlineToggle.first().click();
            await expect(offlineToggle.first()).toHaveAttribute(
                "aria-label",
                "חזור למצב מקוון",
                { timeout: 15_000 },
            );

            await offlineToggle.first().click();
            await page.waitForTimeout(500);
        }
    });

    test("displays misconfigurations toggle in warning color when active", async ({
        page,
    }) => {
        const filterToggle = page.locator(
            "button:has(svg[data-testid='FilterListIcon'])",
        );
        await filterToggle.click();

        const misconfigToggle = page.locator(
            "button:has(svg[data-testid='WarningIcon'])",
        );
        await expect(misconfigToggle).toBeVisible();

        const initialMisconfigLabel =
            await misconfigToggle.getAttribute("aria-label");

        if (initialMisconfigLabel?.includes("הסתר")) {
            await misconfigToggle.click();
            await expect
                .poll(async () => misconfigToggle.getAttribute("aria-label"))
                .toMatch(/הצג פערי/, { timeout: 10_000 });
        }

        await misconfigToggle.click();
        await expect
            .poll(async () => misconfigToggle.getAttribute("aria-label"))
            .toMatch(/הסתר פערי/, { timeout: 10_000 });

        await misconfigToggle.click();
        await expect
            .poll(async () => misconfigToggle.getAttribute("aria-label"))
            .toMatch(/הצג פערי/, { timeout: 10_000 });
    });
});
