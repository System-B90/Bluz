import { expect, test, waitForAppLoad } from "./fixtures";
import { createCurriculum, createEvent, createModule, createSyllabus } from "./gantt-api";

/**
 * #858: the gantt table (טבלה) has a right-click menu whose entries reuse the
 * keyboard handlers.
 */
test.describe("Gantt grid right-click menu", () => {
    test.describe.configure({ timeout: 90_000 });

    test("summary and event rows open their menus, and Open reaches the dialog", async ({ page, request }) => {
        const curriculumId = await createCurriculum(request, "e2e-grid-menu");
        const syllabusTitle = `grid-menu-${Date.now()}`;
        const syllabusId = await createSyllabus(request, curriculumId, syllabusTitle);
        const moduleId = await createModule(request, syllabusId, "grid-menu-module");
        await createEvent(request, moduleId, "grid-menu-event");

        await page.goto(`/gantt?gc=${curriculumId}`, { waitUntil: "commit", timeout: 60_000 });
        await waitForAppLoad(page);
        await page.getByRole("tab", { name: "טבלה" }).click();
        const grid = page.getByRole("grid", { name: "טבלת גאנט" });
        await expect(grid).toBeVisible({ timeout: 30_000 });

        const syllabusCell = grid.getByRole("cell", { name: syllabusTitle });
        await syllabusCell.click({ button: "right" });
        const menu = page.getByRole("menu");
        await expect(menu).toBeVisible();
        for (const label of [ "פתיחה", "הרחבת הכל מתחת", "כיווץ הכל מתחת", "העתקת ערך" ]) {
            await expect(menu.getByRole("menuitem", { name: label })).toBeVisible();
        }

        // Expand everything under the syllabus: the event row shows up.
        await menu.getByRole("menuitem", { name: "הרחבת הכל מתחת" }).click();
        const eventCell = grid.getByRole("cell", { name: "grid-menu-event" });
        await expect(eventCell).toBeVisible();

        await eventCell.click({ button: "right" });
        await expect(page.getByRole("menuitem", { name: "פתיחה" })).toBeVisible();
        await page.getByRole("menuitem", { name: "פתיחה" }).click();
        await expect(page.getByRole("dialog").filter({ hasText: "grid-menu-event" })).toBeVisible({ timeout: 15_000 });
    });
});