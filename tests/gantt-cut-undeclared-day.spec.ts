import { APIRequestContext } from "@playwright/test";

import { expect, test } from "./fixtures";

/**
 * Regression: cut crashed with "Cannot read properties of undefined (reading
 * 'loadMinutes')".
 *
 * A day with no working window (`totalWorkingMinutes` 0, no end time) is
 * Saturday by default, or any day whose hours were cleared. A constrained
 * event on such a day, with an allowed day elsewhere in the week, made the
 * constraint solver throw and the cut fail with a 500. The seeded e2e
 * curriculum never puts a constrained event on one, so the suite never hit
 * it; this spec builds the failing shape from scratch.
 */

const SUITE_TAG = "e2e-cut-undeclared";

type Json = Record<string, unknown>;
type Envelope<T> = { status: number; data: T; error?: unknown };

async function apiJson<T = Json>(response: Awaited<ReturnType<APIRequestContext["get"]>>): Promise<T> {
    const body = (await response.json()) as Envelope<T>;
    expect(body.status, `API error: ${JSON.stringify(body.error ?? body)}`).toBe(0);
    return body.data;
}

/** Next Sunday a fortnight out, well clear of the seeded demo data. */
function upcomingSunday(): string {
    const date = new Date();
    date.setDate(date.getDate() + 14 + ((7 - date.getDay()) % 7));
    return date.toISOString().slice(0, 10);
}

type Fixture = {
    curriculumId: string;
    dayIds: Array<string>;
    eventId: string;
    iterationId: string;
    previousCurriculumId: null | string;
};

/**
 * A live curriculum with one week (new weeks give every day but Saturday a
 * window). The days in `undeclaredDays` have their window cleared; one event
 * sits on `sourceDay` and must move to `allowedDay`.
 */
async function buildFixture(
    request: APIRequestContext,
    {
        undeclaredDays,
        allowedDay,
        sourceDay = 0,
    }: { undeclaredDays: Array<number>; allowedDay: number; sourceDay?: number },
): Promise<Fixture> {
    const curriculum = await apiJson<{ id: string }>(
        await request.post("/api/gantt/curriculums", {
            data: {
                description: SUITE_TAG,
                isArchived: false,
                isDraft: false,
                startDate: upcomingSunday(),
                title: `${SUITE_TAG}-${Date.now()}`,
            },
        }),
    );
    await apiJson(
        await request.post("/api/gantt/weeks", {
            data: { curriculumId: curriculum.id, number: 0, weekendDuty: false },
        }),
    );

    const tree = await apiJson<{
        c2w: Array<{ week: { w2d: Array<{ day: { dayIndex: number; id: string } }> } }>;
    }>(await request.get(`/api/gantt/curriculums/${curriculum.id}`));
    const dayIds = tree.c2w[0].week.w2d
        .sort((a, b) => a.day.dayIndex - b.day.dayIndex)
        .map((link) => link.day.id);

    for (const dayIndex of undeclaredDays) {
        await apiJson(
            await request.patch(`/api/gantt/days/${dayIds[dayIndex]}`, {
                data: { dayEndTime: null, totalWorkingMinutes: 0 },
            }),
        );
    }

    const syllabus = await apiJson<{ id: string }>(
        await request.post("/api/gantt/syllabuses", {
            data: { curriculumId: curriculum.id, hiveIds: [], title: `${SUITE_TAG}-syllabus` },
        }),
    );
    const module = await apiJson<{ id: string }>(
        await request.post("/api/gantt/modules", {
            data: { description: "", hiveIds: [], syllabusId: syllabus.id, title: `${SUITE_TAG}-module` },
        }),
    );
    const event = await apiJson<{ id: string }>(
        await request.post("/api/gantt/events", {
            data: {
                comment: null,
                hiveLessonId: null,
                hiveModuleId: null,
                hiveSubjectId: null,
                isCritical: false,
                isPaWindow: false,
                minimumDuration: 60,
                moduleId: module.id,
                orchestratorId: null,
                recommendedLecturerIds: [],
                recurrence: "none",
                roomRequirement: "בחוץ",
                splitAcrossBreaks: false,
                systemRequirements: [],
                title: `${SUITE_TAG}-event`,
                type: "הרצאה",
            },
        }),
    );
    await apiJson(
        await request.post(`/api/gantt/curriculums/${curriculum.id}/mappings`, {
            data: { allottedMinutes: 60, dayId: dayIds[sourceDay], eventId: event.id, moduleId: module.id, sortOrder: 0 },
        }),
    );
    await apiJson(
        await request.post(`/api/gantt/curriculums/${curriculum.id}/constraints`, {
            data: {
                id: `${SUITE_TAG}-${Date.now()}`,
                type: "TEMPORAL",
                ownerType: "event",
                ownerEventId: event.id,
                allowedDays: [allowedDay],
            },
        }),
    );

    const iteration = await apiJson<{ ganttCurriculumId: null | string; id: string }>(
        await request.get("/api/iterations/current"),
    );
    await apiJson(
        await request.patch(`/api/iterations/${iteration.id}`, {
            data: { ganttCurriculumId: curriculum.id },
        }),
    );

    return {
        curriculumId: curriculum.id,
        dayIds,
        eventId: event.id,
        iterationId: iteration.id,
        previousCurriculumId: iteration.ganttCurriculumId ?? null,
    };
}

async function teardown(request: APIRequestContext, fixture: Fixture): Promise<void> {
    await request.delete(`/api/gantt/curriculums/${fixture.curriculumId}/cut`);
    await request.patch(`/api/iterations/${fixture.iterationId}`, {
        data: { ganttCurriculumId: fixture.previousCurriculumId },
    });
    await request.delete(`/api/gantt/curriculums/${fixture.curriculumId}`);
}

type PlanReport = {
    constraintProposals: Array<{ eventId: string; fromDayId: string; toDayId: string }>;
    constraintViolations: Array<unknown>;
};

async function plan(request: APIRequestContext, fixture: Fixture, data: Json = {}) {
    return await request.post(`/api/gantt/curriculums/${fixture.curriculumId}/cut/plan`, { data });
}

test.describe("Cut with a constrained event on an undeclared day", () => {
    test.describe.configure({ mode: "serial", timeout: 120_000 });

    test("preview does not crash", async ({ request }) => {
        const fixture = await buildFixture(request, { undeclaredDays: [0], allowedDay: 2 });
        try {
            const response = await request.get(`/api/gantt/curriculums/${fixture.curriculumId}/cut/preview`);
            expect(response.status()).toBe(200);
            expect(await response.text()).not.toContain("loadMinutes");
        } finally {
            await teardown(request, fixture);
        }
    });

    test("plan proposes moving the event to the allowed day", async ({ request }) => {
        const fixture = await buildFixture(request, { undeclaredDays: [0], allowedDay: 2 });
        try {
            const response = await plan(request, fixture);
            expect(response.status()).toBe(200);
            const body = (await response.json()) as Envelope<{ ok: boolean; report: PlanReport }>;
            expect(body.status).toBe(0);
            expect(body.data.ok).toBe(true);
            expect(body.data.report.constraintProposals).toEqual([
                expect.objectContaining({
                    eventId: fixture.eventId,
                    fromDayId: fixture.dayIds[0],
                    toDayId: fixture.dayIds[2],
                }),
            ]);
        } finally {
            await teardown(request, fixture);
        }
    });

    test("plan with the move accepted does not crash", async ({ request }) => {
        const fixture = await buildFixture(request, { undeclaredDays: [0], allowedDay: 2 });
        try {
            const response = await plan(request, fixture, { acceptedConstraintMoves: [fixture.eventId] });
            expect(response.status()).toBe(200);
            expect(((await response.json()) as Envelope<unknown>).status).toBe(0);
        } finally {
            await teardown(request, fixture);
        }
    });

    test("the cut commits with the move accepted", async ({ request }) => {
        const fixture = await buildFixture(request, { undeclaredDays: [0], allowedDay: 2 });
        try {
            const response = await request.post(`/api/gantt/curriculums/${fixture.curriculumId}/cut`, {
                data: { acceptedConstraintMoves: [fixture.eventId] },
            });
            expect(response.status()).toBeLessThan(500);
            expect(await response.text()).not.toContain("loadMinutes");
        } finally {
            await teardown(request, fixture);
        }
    });

    test("with no declared day at all, plan reports instead of crashing", async ({ request }) => {
        const fixture = await buildFixture(request, { undeclaredDays: [0, 1, 2, 3, 4, 5, 6], allowedDay: 2 });
        try {
            const response = await plan(request, fixture);
            expect(response.status()).toBe(200);
            const body = (await response.json()) as Envelope<{ ok: boolean; report: PlanReport }>;
            expect(body.data.report.constraintProposals).toEqual([]);
            expect(body.data.report.constraintViolations).toHaveLength(1);
        } finally {
            await teardown(request, fixture);
        }
    });
    test("a constrained event on Saturday (no window by default) moves off it", async ({ request }) => {
        const fixture = await buildFixture(request, { undeclaredDays: [], allowedDay: 2, sourceDay: 6 });
        try {
            const response = await plan(request, fixture);
            expect(response.status()).toBe(200);
            const body = (await response.json()) as Envelope<{ ok: boolean; report: PlanReport }>;
            expect(body.status).toBe(0);
            expect(body.data.report.constraintProposals).toEqual([
                expect.objectContaining({
                    eventId: fixture.eventId,
                    fromDayId: fixture.dayIds[6],
                    toDayId: fixture.dayIds[2],
                }),
            ]);
        } finally {
            await teardown(request, fixture);
        }
    });
});
