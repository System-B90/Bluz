import { expect, test, waitForAppLoad } from "./fixtures";
import { createHoursCourseFixture, deleteCourses, TestCourse } from "./hours-course-fixture";

/**
 * #899: the gantt's scheduled hours are one student's time. A 1h event for
 * one course and a 2h event for its sibling course on the same day make a 2h
 * week (the busiest course), not 3h, and a dropdown in the header picks the
 * course to count — in the table and on the timeline alike.
 */

test.describe("Gantt scheduled hours per course (#899)", () => {
    test.describe.configure({ timeout: 120_000 });

    const courses: Array<TestCourse> = [];
    test.afterEach(async ({ request }) => {
        await deleteCourses(request, courses.splice(0));
    });

    test("the table and timeline count one course at a time", async ({ page, request }) => {
        const { curriculumId, courses: created, short, long } = await createHoursCourseFixture(request, "e2e-hours-course");
        courses.push(...created);

        await page.goto(`/gantt?gc=${curriculumId}`, { waitUntil: "commit", timeout: 60_000 });
        await waitForAppLoad(page);
        const picker = page.getByRole("combobox", { name: "קורס לחישוב השעות" });
        const pick = async (name: string) => {
            await picker.click();
            await page.getByRole("option", { name }).click();
            await expect(picker).toHaveText(name);
        };

        // Timeline: the week header shows the busiest course's 2h.
        await page.getByRole("tab", { name: "רצף זמן" }).click();
        const weekHours = page.getByTestId("gantt-week-hours").first();
        await expect(weekHours).toHaveText(/^2 ש׳ \//, { timeout: 30_000 });
        await pick(short.name);
        await expect(weekHours).toHaveText(/^1 ש׳ \//);

        // Table: the pick carries over, and the dropdown sits inside the scheduled cell.
        await page.getByRole("tab", { name: "טבלה" }).click();
        const grid = page.getByRole("grid", { name: "טבלת גאנט" });
        await expect(grid).toBeVisible({ timeout: 30_000 });
        const scheduledRow = grid.getByRole("row").filter({ hasText: "זמן משובץ" });
        await expect(scheduledRow.getByRole("combobox")).toHaveText(short.name);
        const firstWeek = scheduledRow.getByRole("columnheader").nth(1);
        await expect(firstWeek).toHaveText("1");

        await pick(long.name);
        await expect(firstWeek).toHaveText("2");
        await pick("הקורס העמוס ביותר");
        await expect(firstWeek).toHaveText("2");
    });
});
