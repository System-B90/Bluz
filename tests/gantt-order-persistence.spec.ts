import { APIRequestContext } from "@playwright/test";

import { expect, test } from "./fixtures";

/**
 * Module and event order survives a reload (#761).
 *
 * New modules/events were linked with the junction's default `sort_order`
 * (0) while the client appended them last. After a reorder the new row
 * sorted first on the next read, so the saved order looked lost. Ties
 * between legacy rows also sorted nondeterministically.
 */

const SUITE_TAG = "e2e-order";

type Json = Record<string, unknown>;

async function apiJson<T = Json>(
    response: Awaited<ReturnType<APIRequestContext["get"]>>,
): Promise<T> {
    const body = await response.json();
    expect(body.status, `API error: ${JSON.stringify(body.error ?? body)}`).toBe(0);
    return body.data as T;
}

function upcomingSunday(): string {
    const date = new Date();
    date.setDate(date.getDate() + 14 + ((7 - date.getDay()) % 7));
    return date.toISOString().slice(0, 10);
}

async function createCurriculum(request: APIRequestContext): Promise<string> {
    const { id } = await apiJson<{ id: string }>(
        await request.post("/api/gantt/curriculums", {
            data: {
                description: SUITE_TAG,
                isArchived: false,
                isDraft: true,
                startDate: upcomingSunday(),
                title: `${SUITE_TAG}-${Date.now()}`,
            },
        }),
    );
    return id;
}

async function createSyllabus(request: APIRequestContext, curriculumId: string): Promise<string> {
    const { id } = await apiJson<{ id: string }>(
        await request.post("/api/gantt/syllabuses", {
            data: { curriculumId, hiveIds: [], title: `${SUITE_TAG}-syllabus` },
        }),
    );
    return id;
}

async function createModule(request: APIRequestContext, syllabusId: string, title: string): Promise<string> {
    const { id } = await apiJson<{ id: string }>(
        await request.post("/api/gantt/modules", {
            data: { description: "", hiveIds: [], syllabusId, title },
        }),
    );
    return id;
}

async function createEvent(request: APIRequestContext, moduleId: string, title: string): Promise<string> {
    const { id } = await apiJson<{ id: string }>(
        await request.post("/api/gantt/events", {
            data: {
                allocatedDuration: 60,
                comment: null,
                hiveLessonId: null,
                hiveModuleId: null,
                hiveSubjectId: null,
                isCritical: false,
                isPaWindow: false,
                minimumDuration: 60,
                moduleId,
                orchestratorId: null,
                recommendedLecturerIds: [],
                recurrence: "none",
                roomRequirement: "בחוץ",
                splitAcrossBreaks: false,
                systemRequirements: [],
                title,
                type: "הרצאה",
            },
        }),
    );
    return id;
}

type RawModule = { m2e: Array<{ eventId: string }> };
type RawSyllabus = { s2m: Array<{ moduleId: string; module: RawModule }> };

async function moduleOrder(request: APIRequestContext, syllabusId: string): Promise<Array<string>> {
    const syllabus = await apiJson<RawSyllabus>(await request.get(`/api/gantt/syllabuses/${syllabusId}`));
    return syllabus.s2m.map((row) => row.moduleId);
}

async function eventOrder(request: APIRequestContext, moduleId: string): Promise<Array<string>> {
    const module = await apiJson<RawModule>(await request.get(`/api/gantt/modules/${moduleId}`));
    return module.m2e.map((row) => row.eventId);
}

async function curriculumOrders(
    request: APIRequestContext,
    curriculumId: string,
    syllabusId: string,
    moduleId: string,
): Promise<{ modules: Array<string>; events: Array<string> }> {
    const curriculum = await apiJson<{ c2s: Array<{ syllabusId: string; syllabus: RawSyllabus }> }>(
        await request.get(`/api/gantt/curriculums/${curriculumId}`),
    );
    const syllabus = curriculum.c2s.find((row) => row.syllabusId === syllabusId)?.syllabus;
    const s2m = syllabus?.s2m ?? [];
    return {
        events: s2m.find((row) => row.moduleId === moduleId)?.module.m2e.map((row) => row.eventId) ?? [],
        modules: s2m.map((row) => row.moduleId),
    };
}

async function reorderModules(request: APIRequestContext, syllabusId: string, moduleIds: Array<string>) {
    await apiJson(
        await request.post(`/api/gantt/syllabuses/${syllabusId}/reorder-modules`, {
            data: { moduleIds },
        }),
    );
}

async function reorderEvents(request: APIRequestContext, moduleId: string, eventIds: Array<string>) {
    await apiJson(
        await request.post(`/api/gantt/modules/${moduleId}/reorder-events`, {
            data: { eventIds },
        }),
    );
}

test.describe("Gantt order persistence (#761)", () => {
    test.describe.configure({ timeout: 90_000 });

    let curriculumId: string;
    let syllabusId: string;

    test.beforeEach(async ({ request }) => {
        curriculumId = await createCurriculum(request);
        syllabusId = await createSyllabus(request, curriculumId);
    });

    test.afterEach(async ({ request }) => {
        await request.delete(`/api/gantt/curriculums/${curriculumId}`);
    });

    test("modules come back in creation order", async ({ request }) => {
        const ids = [];
        for (const t of ["a", "b", "c", "d"]) ids.push(await createModule(request, syllabusId, t));
        expect(await moduleOrder(request, syllabusId)).toEqual(ids);
    });

    test("events come back in creation order", async ({ request }) => {
        const moduleId = await createModule(request, syllabusId, "m");
        const ids = [];
        for (const t of ["a", "b", "c", "d"]) ids.push(await createEvent(request, moduleId, t));
        expect(await eventOrder(request, moduleId)).toEqual(ids);
    });

    test("a reordered module list persists", async ({ request }) => {
        const [a, b, c] = [
            await createModule(request, syllabusId, "a"),
            await createModule(request, syllabusId, "b"),
            await createModule(request, syllabusId, "c"),
        ];
        await reorderModules(request, syllabusId, [c, a, b]);
        expect(await moduleOrder(request, syllabusId)).toEqual([c, a, b]);
    });

    test("a reordered event list persists", async ({ request }) => {
        const moduleId = await createModule(request, syllabusId, "m");
        const [a, b, c] = [
            await createEvent(request, moduleId, "a"),
            await createEvent(request, moduleId, "b"),
            await createEvent(request, moduleId, "c"),
        ];
        await reorderEvents(request, moduleId, [b, c, a]);
        expect(await eventOrder(request, moduleId)).toEqual([b, c, a]);
    });

    test("a module added after a reorder lands last, not first", async ({ request }) => {
        const [a, b] = [
            await createModule(request, syllabusId, "a"),
            await createModule(request, syllabusId, "b"),
        ];
        await reorderModules(request, syllabusId, [b, a]);
        const c = await createModule(request, syllabusId, "c");
        expect(await moduleOrder(request, syllabusId)).toEqual([b, a, c]);
    });

    test("an event added after a reorder lands last, not first", async ({ request }) => {
        const moduleId = await createModule(request, syllabusId, "m");
        const [a, b] = [
            await createEvent(request, moduleId, "a"),
            await createEvent(request, moduleId, "b"),
        ];
        await reorderEvents(request, moduleId, [b, a]);
        const c = await createEvent(request, moduleId, "c");
        expect(await eventOrder(request, moduleId)).toEqual([b, a, c]);
    });

    test("the reorder survives repeated reads", async ({ request }) => {
        const ids = [];
        for (const t of ["a", "b", "c", "d", "e"]) ids.push(await createModule(request, syllabusId, t));
        const wanted = [...ids].reverse();
        await reorderModules(request, syllabusId, wanted);
        for (let i = 0; i < 5; i++) {
            expect(await moduleOrder(request, syllabusId)).toEqual(wanted);
        }
    });

    test("several reorders in a row keep only the last", async ({ request }) => {
        const moduleId = await createModule(request, syllabusId, "m");
        const [a, b, c] = [
            await createEvent(request, moduleId, "a"),
            await createEvent(request, moduleId, "b"),
            await createEvent(request, moduleId, "c"),
        ];
        await reorderEvents(request, moduleId, [c, b, a]);
        await reorderEvents(request, moduleId, [a, c, b]);
        await reorderEvents(request, moduleId, [b, a, c]);
        expect(await eventOrder(request, moduleId)).toEqual([b, a, c]);
    });

    test("the curriculum read agrees with the syllabus read", async ({ request }) => {
        const [a, b, c] = [
            await createModule(request, syllabusId, "a"),
            await createModule(request, syllabusId, "b"),
            await createModule(request, syllabusId, "c"),
        ];
        await reorderModules(request, syllabusId, [b, c, a]);
        const [e1, e2] = [await createEvent(request, b, "1"), await createEvent(request, b, "2")];
        await reorderEvents(request, b, [e2, e1]);
        const e3 = await createEvent(request, b, "3");

        const orders = await curriculumOrders(request, curriculumId, syllabusId, b);
        expect(orders.modules).toEqual([b, c, a]);
        expect(orders.events).toEqual([e2, e1, e3]);
    });

    test("reordering one module leaves a sibling's events alone", async ({ request }) => {
        const m1 = await createModule(request, syllabusId, "m1");
        const m2 = await createModule(request, syllabusId, "m2");
        const [x, y] = [await createEvent(request, m1, "x"), await createEvent(request, m1, "y")];
        const [p, q] = [await createEvent(request, m2, "p"), await createEvent(request, m2, "q")];
        await reorderEvents(request, m1, [y, x]);
        expect(await eventOrder(request, m2)).toEqual([p, q]);
        expect(await eventOrder(request, m1)).toEqual([y, x]);
    });

    test("the module order survives a page reload in the UI", async ({ page, request }) => {
        const titles = ["ראשון", "שני", "שלישי"].map((t) => `${SUITE_TAG}-${t}-${Date.now()}`);
        const ids = [];
        for (const t of titles) ids.push(await createModule(request, syllabusId, t));
        await reorderModules(request, syllabusId, [ids[2], ids[0], ids[1]]);
        await createModule(request, syllabusId, `${SUITE_TAG}-last-${Date.now()}`);

        await page.goto(`/gantt?gc=${curriculumId}`, { waitUntil: "commit", timeout: 60_000 });
        const first = page.getByText(titles[2]).first();
        await expect(first).toBeVisible({ timeout: 30_000 });
        const y = async (t: string) => (await page.getByText(t).first().boundingBox())?.y ?? 0;
        expect(await y(titles[2])).toBeLessThan(await y(titles[0]));
        expect(await y(titles[0])).toBeLessThan(await y(titles[1]));
    });
});
