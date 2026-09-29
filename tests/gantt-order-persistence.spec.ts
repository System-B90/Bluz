import {
    createCurriculum,
    createEvent,
    createModule,
    createSyllabus,
    curriculumOrders,
    eventOrder,
    moduleOrder,
    reorderEvents,
    reorderModules,
} from "./gantt-api";
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

test.describe("Gantt order persistence (#761)", () => {
    test.describe.configure({ timeout: 90_000 });

    let curriculumId: string;
    let syllabusId: string;

    test.beforeEach(async ({ request }) => {
        curriculumId = await createCurriculum(request, SUITE_TAG);
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
