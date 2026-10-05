import { APIRequestContext, expect } from "@playwright/test";

import { apiJson, createCurriculum, createEvent, createModule, createSyllabus } from "./gantt-api";

/**
 * #899 fixture: a root course split into a "short" and a "long" sub-course,
 * and a one-week curriculum with a 1h short-only and a 2h long-only event on
 * its Sunday. One student's week is 2h (the busiest course), never 3h.
 */

export type TestCourse = { id: string; name: string; parentId: null | string };

export type HoursCourseFixture = {
    curriculumId: string;
    courses: Array<TestCourse>;
    short: TestCourse;
    long: TestCourse;
};

async function createCourse(request: APIRequestContext, name: string, parentId: null | string = null): Promise<TestCourse> {
    const course = { id: `course-${crypto.randomUUID()}`, name, color: null, parentId, description: "e2e #899 fixture" };
    expect((await request.put("/api/course", { data: course })).ok(), `failed to create course ${name}`).toBeTruthy();
    return course;
}

export async function deleteCourses(request: APIRequestContext, courses: Array<TestCourse>): Promise<void> {
    for (const course of [ ...courses ].reverse()) {
        const response = await request.delete("/api/course", { data: course.id });
        if (!response.ok()) await request.delete("/api/course", { data: JSON.stringify(course.id) });
    }
}

/** Builds the fixture. Its courses are global: pass `fixture.courses` to `deleteCourses` afterwards. */
export async function createHoursCourseFixture(request: APIRequestContext, tag: string): Promise<HoursCourseFixture> {
    const stamp = Date.now();
    const root = await createCourse(request, `שורש-${stamp}`);
    const short = await createCourse(request, `קצר-${stamp}`, root.id);
    const long = await createCourse(request, `ארוך-${stamp}`, root.id);

    const curriculumId = await createCurriculum(request, tag);
    await apiJson(await request.post("/api/gantt/weeks", { data: { curriculumId, number: 0, weekendDuty: false } }));
    const tree = await apiJson<{ c2w: Array<{ week: { w2d: Array<{ day: { dayIndex: number; id: string } }> } }> }>(
        await request.get(`/api/gantt/curriculums/${curriculumId}`),
    );
    const sunday = tree.c2w[ 0 ].week.w2d.find((link) => link.day.dayIndex === 0)?.day.id;
    expect(sunday).toBeTruthy();

    const syllabusId = await createSyllabus(request, curriculumId, `${tag}-${stamp}`);
    const moduleId = await createModule(request, syllabusId, `${tag}-module`);
    const events = [
        [ await createEvent(request, moduleId, `${tag}-short`, { courseIds: [ short.id ], minimumDuration: 60 }), 60 ],
        [ await createEvent(request, moduleId, `${tag}-long`, { courseIds: [ long.id ], minimumDuration: 120 }), 120 ],
    ] as const;
    for (const [ index, [ eventId, minutes ] ] of events.entries()) {
        await apiJson(await request.post(`/api/gantt/curriculums/${curriculumId}/mappings`, {
            data: { allottedMinutes: minutes, dayId: sunday, eventId, moduleId, sortOrder: index },
        }));
    }
    return { curriculumId, courses: [ root, short, long ], short, long };
}
