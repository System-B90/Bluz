import { APIRequestContext } from "@playwright/test";

import { expect, test, waitForAppLoad } from "./fixtures";
import { apiJson, createCurriculum, createEvent, createModule, createSyllabus } from "./gantt-api";

/**
 * #899: the gantt's scheduled hours are one student's time. A 1h event for
 * one course and a 2h event for its sibling course on the same day make a 2h
 * week (the busiest course), not 3h, and a dropdown in the header picks the
 * course to count — in the table and on the timeline alike.
 */

type TestCourse = { id: string; name: string; parentId: null | string };

async function createCourse(request: APIRequestContext, name: string, parentId: null | string = null): Promise<TestCourse> {
    const course = { id: `course-${crypto.randomUUID()}`, name, color: null, parentId, description: "e2e #899 fixture" };
    expect((await request.put("/api/course", { data: course })).ok(), `failed to create course ${name}`).toBeTruthy();
    return course;
}

async function deleteCourses(request: APIRequestContext, courses: Array<TestCourse>): Promise<void> {
    for (const course of [ ...courses ].reverse()) {
        const response = await request.delete("/api/course", { data: course.id });
        if (!response.ok()) await request.delete("/api/course", { data: JSON.stringify(course.id) });
    }
}

test.describe("Gantt scheduled hours per course (#899)", () => {
    test.describe.configure({ timeout: 120_000 });

    const courses: Array<TestCourse> = [];
    test.afterEach(async ({ request }) => {
        await deleteCourses(request, courses.splice(0));
    });

    test("the table and timeline count one course at a time", async ({ page, request }) => {
        const tag = Date.now();
        const root = await createCourse(request, `שורש-${tag}`);
        const short = await createCourse(request, `קצר-${tag}`, root.id);
        const long = await createCourse(request, `ארוך-${tag}`, root.id);
        courses.push(root, short, long);

        const curriculumId = await createCurriculum(request, "e2e-hours-course");
        await apiJson(await request.post("/api/gantt/weeks", { data: { curriculumId, number: 0, weekendDuty: false } }));
        const tree = await apiJson<{ c2w: Array<{ week: { w2d: Array<{ day: { dayIndex: number; id: string } }> } }> }>(
            await request.get(`/api/gantt/curriculums/${curriculumId}`),
        );
        const sunday = tree.c2w[ 0 ].week.w2d.find((link) => link.day.dayIndex === 0)?.day.id;
        expect(sunday).toBeTruthy();

        const syllabusId = await createSyllabus(request, curriculumId, `hours-course-${tag}`);
        const moduleId = await createModule(request, syllabusId, "hours-course-module");
        const events = [
            [ await createEvent(request, moduleId, "hours-course-short", { courseIds: [ short.id ], minimumDuration: 60 }), 60 ],
            [ await createEvent(request, moduleId, "hours-course-long", { courseIds: [ long.id ], minimumDuration: 120 }), 120 ],
        ] as const;
        for (const [ index, [ eventId, minutes ] ] of events.entries()) {
            await apiJson(await request.post(`/api/gantt/curriculums/${curriculumId}/mappings`, {
                data: { allottedMinutes: minutes, dayId: sunday, eventId, moduleId, sortOrder: index },
            }));
        }

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
