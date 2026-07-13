import { test, expect, SELECTORS, gotoAppHome, waitForAppLoad } from "./fixtures";

/**
 * Gantt page integration tests.
 * Covers: page load, placeholder state, curriculum drawer, curriculum selection,
 *         tab navigation, URL parameter synchronization.
 */

test.describe("Gantt Page", () => {
    test.beforeEach(async ({ page }) => {
        await page.goto("/gantt");
        await waitForAppLoad(page);

        // Ensure at least one curriculum exists so selection and view tests work
        const fab = page.getByRole("button", { name: "גאנטים" });
        await fab.click();
        await page.waitForTimeout(500);

        // Wait for skeleton loaders to disappear (indicates details are fetched and buttons enabled)
        await page.locator(".MuiSkeleton-root").waitFor({ state: "hidden", timeout: 10_000 });

        const listItems = page.locator("[role='presentation'] ul li").filter({ has: page.getByRole("button") });
        const count = await listItems.count();
        if (count === 0) {
            // Create actions are hidden behind a hover-reveal trigger.
            const createTrigger = page.getByRole("button", { name: "גאנט חדש" });
            await createTrigger.click();
            // Let the Collapse finish expanding before clicking a target
            // whose position is still shifting mid-animation.
            await page.waitForTimeout(400);

            const draftButton = page.locator('span[title="דראפט חדש"] button, span[aria-label="דראפט חדש"] button');
            await draftButton.click();
            
            // Wait for the newly created curriculum to appear in the list
            await expect(page.getByText("הגאנט שלי").first()).toBeVisible({ timeout: 10_000 });

            // Go back to /gantt to clear the selected curriculum from URL for a clean starting state
            await page.goto("/gantt");
            await waitForAppLoad(page);
        }
        
        // Close the FAB popover
        await page.keyboard.press("Escape");
        await page.waitForTimeout(300);
    });

    // ─── Page Load ──────────────────────────────────────────────────────────

    // TODO(#97-followup): flaky/blocked in hermetic CI — the curriculum delete
    // button ("מחיקה") stays disabled on freshly-seeded demo data, so the
    // delete-all cleanup loop times out. Re-enable once the seed provides a
    // deletable curriculum or the test selects one first to enable delete.
    test.fixme("renders the Gantt page with placeholder text", async ({ page }) => {
        const fab = page.getByRole("button", { name: "גאנטים" });

        // Delete every curriculum in the list so the placeholder is visible.
        // Each delete click may close the FAB (Tooltip-Portal / ClickAwayListener),
        // so we reopen it at the top of each iteration.
        // eslint-disable-next-line no-constant-condition
        while (true) {
            await fab.click();
            // Wait for item skeletons to resolve before looking for the button
            await page.locator(".MuiSkeleton-root").waitFor({ state: "hidden", timeout: 10_000 });

            const deleteButton = page.getByRole("button", { name: "מחיקה" });
            if (!await deleteButton.isVisible()) {
                await page.keyboard.press("Escape");
                await page.waitForTimeout(300);
                break;
            }
            await deleteButton.click();
            await page.waitForTimeout(1_000);
        }

        // Without a selected curriculum, the placeholder should be visible
        await expect(
            page.getByText("בחרו גאנט כדי להתחיל לעבוד"),
        ).toBeVisible();
    });

    test("renders the AppBar on the Gantt page", async ({ page }) => {
        const appBar = page.locator(SELECTORS.appBar);
        await expect(appBar).toBeVisible();
    });

    // ─── Curriculum Drawer (FAB) ────────────────────────────────────────────

    test("displays the curriculum FAB/drawer", async ({ page }) => {
        const fab = page.getByRole("button", { name: "גאנטים" });
        await expect(fab).toBeVisible();
    });

    test("toggles the curriculum drawer open and closed", async ({ page }) => {
        const fab = page.getByRole("button", { name: "גאנטים" });
        await expect(fab).toBeVisible();

        const heading = page.getByRole("heading", { name: "גאנטים", exact: true });
        await expect(heading).not.toBeVisible();

        // Click to open
        await fab.click();
        await expect(heading).toBeVisible();

        // Press Escape to close
        await page.keyboard.press("Escape");
        await expect(heading).not.toBeVisible();
    });

    // ─── Curriculum Selection ───────────────────────────────────────────────

    test("creates a new curriculum", async ({ page }) => {
        // Open FAB first
        const fab = page.getByRole("button", { name: "גאנטים" });
        await fab.click();

        // Create actions are hidden behind a hover-reveal trigger.
        const createTrigger = page.getByRole("button", { name: "גאנט חדש" });
        await createTrigger.click();
        // Let the Collapse finish expanding before clicking a target whose
        // position is still shifting mid-animation.
        await page.waitForTimeout(400);

        // Click "דראפט חדש" button
        const draftButton = page.locator('span[title="דראפט חדש"] button, span[aria-label="דראפט חדש"] button');
        await expect(draftButton).toBeVisible();
        await draftButton.click();

        // Wait for the newly created curriculum to appear in the list
        await expect(page.getByText("הגאנט שלי").first()).toBeVisible({ timeout: 10_000 });
    });

    test("selects a curriculum and shows loading/content", async ({ page }) => {
        // Open FAB first
        const fab = page.getByRole("button", { name: "גאנטים" });
        await fab.click();
        
        // Wait for the curriculum entries to load (replaces skeleton loader)
        await expect(page.getByText("הגאנט שלי").first()).toBeVisible({ timeout: 10_000 });

        // Look for curriculum list items in the sidebar
        const curriculumItems = page
            .locator("[role='presentation'] ul li")
            .filter({ has: page.getByRole("button") });

        if ((await curriculumItems.count()) > 0) {
            // Click the first curriculum
            await curriculumItems.first().click();
            await page.waitForTimeout(500);

            // Either loading screen or curriculum view should appear
            const loadingOrContent =
                (await page.getByText("Loading Gantt data").count()) > 0 ||
                (await page.getByText("Mapping Syllabuses").count()) > 0 ||
                (await page.locator("[class*='CurriculumView']").count()) > 0 ||
                // After loading completes, placeholder should be gone
                (await page.getByText("בחרו גאנט כדי להתחיל לעבוד").count()) ===
                    0;

            expect(loadingOrContent).toBeTruthy();

            // URL should now contain ?cid= parameter
            await expect(page).toHaveURL(/cid=/);
        }
    });

    test("URL cid parameter syncs with selected curriculum", async ({
        page,
    }) => {
        // Open FAB first
        const fab = page.getByRole("button", { name: "גאנטים" });
        await fab.click();
        
        // Wait for the curriculum entries to load
        await expect(page.getByText("הגאנט שלי").first()).toBeVisible({ timeout: 10_000 });

        // Navigate with a cid parameter
        const curriculumItems = page
            .locator("[role='presentation'] ul li")
            .filter({ has: page.getByRole("button") });

        if ((await curriculumItems.count()) > 0) {
            await curriculumItems.first().click();
            await page.waitForTimeout(1000);

            // Verify URL has cid
            const url = page.url();
            expect(url).toContain("cid=");

            // Extract cid value
            const urlObj = new URL(url);
            const cid = urlObj.searchParams.get("cid");
            expect(cid).toBeTruthy();
        }
    });

    // ─── Tab Navigation (Curriculum View) ───────────────────────────────────

    test("switches between curriculum view tabs", async ({ page }) => {
        // Open FAB first
        const fab = page.getByRole("button", { name: "גאנטים" });
        await fab.click();
        
        // Wait for the curriculum entries to load
        await expect(page.getByText("הגאנט שלי").first()).toBeVisible({ timeout: 10_000 });

        // Select a curriculum first
        const curriculumItems = page
            .locator("[role='presentation'] ul li")
            .filter({ has: page.getByRole("button") });

        if ((await curriculumItems.count()) > 0) {
            await curriculumItems.first().click();

            // Wait for loading to complete
            await page.waitForTimeout(3000);

            // Look for tab buttons in the curriculum view
            const tabs = page.locator("[role='tab'], [role='tablist'] button");

            if ((await tabs.count()) > 1) {
                // Click the second tab
                await tabs.nth(1).click();
                await page.waitForTimeout(500);

                // URL should update with v= parameter
                await expect(page).toHaveURL(/v=/);

                // Click the first tab
                await tabs.first().click();
                await page.waitForTimeout(500);
            }
        }
    });

    // ─── Gantt Sidebar ──────────────────────────────────────────────────────

    test("curriculum view sidebar renders when curriculum is selected", async ({
        page,
    }) => {
        // Open FAB first
        const fab = page.getByRole("button", { name: "גאנטים" });
        await fab.click();
        
        // Wait for the curriculum entries to load
        await expect(page.getByText("הגאנט שלי").first()).toBeVisible({ timeout: 10_000 });

        const curriculumItems = page
            .locator("[role='presentation'] ul li")
            .filter({ has: page.getByRole("button") });

        if ((await curriculumItems.count()) > 0) {
            await curriculumItems.first().click();
            await page.waitForTimeout(3000);

            // The CurriculumViewSidebar should render with hours info or syllabus actions
            // Check that the main content area is not just the placeholder
            const placeholder = page.getByText("בחרו גאנט כדי להתחיל לעבוד");
            await expect(placeholder).not.toBeVisible();
        }
    });

    // ─── Curriculum Actions ─────────────────────────────────────────────────

    test("curriculum action buttons are available in the FAB", async ({
        page,
    }) => {
        const fab = page.getByRole("button", { name: "גאנטים" });
        await fab.click();
        await page.waitForTimeout(500);

        // Create actions are hidden behind a hover-reveal trigger.
        const createTrigger = page.getByRole("button", { name: "גאנט חדש" });
        await createTrigger.click();

        const draftButton = page.locator('span[title="דראפט חדש"] button, span[aria-label="דראפט חדש"] button');
        await expect(draftButton).toBeVisible();

        await page.keyboard.press("Escape");
    });

    // ─── Navigation ─────────────────────────────────────────────────────────

    test("navigates back to schedule from Gantt via AppBar", async ({
        page,
    }) => {
        const appBar = page.locator(SELECTORS.appBar);

        const scheduleButton = appBar.getByRole("button", { name: 'חזור ללו"ז' });
        await expect(scheduleButton).toBeVisible();
        await scheduleButton.click();
        await expect(page.locator(SELECTORS.calendarRoot)).toBeVisible({
            timeout: 60_000,
        });
    });
});
