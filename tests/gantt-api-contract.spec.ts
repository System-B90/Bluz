import { test, expect } from "./fixtures";

/**
 * Contract tests for the Gantt collection endpoints (#310).
 *
 * These hit the real server rather than a mock, which is the only way to catch
 * the two failure modes the unit tests cannot see: a route that forgets to
 * thread the `withParents` flag through to the db layer, and a junction
 * misconfigured with the wrong cardinality for its entity.
 */

/** Entities whose parent link is one-to-one, with the field each surfaces. */
const SCALAR_ENTITIES = [
    { path: "modules", parentKey: "syllabusId", idPrefix: "s_" },
    { path: "events", parentKey: "moduleId", idPrefix: "m_" },
    { path: "weeks", parentKey: "curriculumId", idPrefix: "c_" },
    { path: "days", parentKey: "weekId", idPrefix: "w_" },
] as const;

test.describe("Gantt collection API - parent ids", () => {
    test("defaults to the flat label map for every entity", async ({
        request,
    }) => {
        for (const { path } of SCALAR_ENTITIES) {
            const response = await request.get(`/api/gantt/${path}`);
            expect(response.ok(), `${path} should respond 200`).toBeTruthy();

            const { data } = await response.json();
            const values = Object.values(data);
            if (values.length === 0) continue;

            // REGRESSION: the unflagged response must stay a bare
            // `Record<id, title>`. Turning this into objects unconditionally
            // would break every existing caller of `apiList`.
            for (const value of values) {
                expect(
                    typeof value === "object" && value !== null,
                    `${path} default response must not be object-valued`,
                ).toBeFalsy();
            }
        }
    });

    for (const { path, parentKey, idPrefix } of SCALAR_ENTITIES) {
        test(`${path} surfaces a scalar ${parentKey} with withParents=1`, async ({
            request,
        }) => {
            const response = await request.get(
                `/api/gantt/${path}?withParents=1`,
            );
            expect(response.ok()).toBeTruthy();

            const { data } = await response.json();
            const entries = Object.values(data) as Array<
                Record<string, unknown>
            >;
            test.skip(entries.length === 0, `no ${path} seeded`);

            for (const entry of entries) {
                expect(entry).toHaveProperty("title");
                expect(entry).toHaveProperty(parentKey);

                const parent = entry[parentKey];
                // REGRESSION: a one-parent junction must never widen to an
                // array — that was the shape mistake #310 had to correct in
                // the other direction for syllabuses.
                expect(Array.isArray(parent)).toBeFalsy();
                if (parent !== null) {
                    expect(String(parent).startsWith(idPrefix)).toBeTruthy();
                }
            }
        });
    }

    test("syllabuses surface curriculumIds as an array", async ({ request }) => {
        const response = await request.get(
            "/api/gantt/syllabuses?withParents=1",
        );
        expect(response.ok()).toBeTruthy();

        const { data } = await response.json();
        const entries = Object.values(data) as Array<Record<string, unknown>>;
        test.skip(entries.length === 0, "no syllabuses seeded");

        for (const entry of entries) {
            // REGRESSION: a syllabus is shareable across curriculums, so this
            // stays a list even when it happens to hold a single id. A scalar
            // here would silently drop the other parents.
            expect(Array.isArray(entry.curriculumIds)).toBeTruthy();
            expect(entry).not.toHaveProperty("curriculumId");
        }
    });

    test("curriculums carry no parent key at all", async ({ request }) => {
        const response = await request.get(
            "/api/gantt/curriculums?withParents=1",
        );
        expect(response.ok()).toBeTruthy();

        const { data } = await response.json();
        const entries = Object.values(data) as Array<Record<string, unknown>>;
        test.skip(entries.length === 0, "no curriculums seeded");

        for (const entry of entries) {
            // Curriculums are the root: no `parentJunction` is configured, so
            // the object form carries the title only.
            expect(entry).toHaveProperty("title");
            expect(Object.keys(entry)).toEqual(["title"]);
        }
    });

    test("a shared syllabus reports every parent, stably", async ({
        request,
    }) => {
        const listResponse = await request.get(
            "/api/gantt/syllabuses?withParents=1",
        );
        const { data: syllabuses } = await listResponse.json();
        const entries = Object.entries(syllabuses) as Array<
            [string, { curriculumIds: Array<string> }]
        >;
        test.skip(entries.length === 0, "no syllabuses seeded");

        // Pick a syllabus that actually has a parent rather than whichever one
        // the map happens to list first: a stack that has run the suite a few
        // times accumulates orphan syllabuses from other specs, and taking
        // entries[0] blindly skipped this test on exactly those.
        const parented = entries.find(
            ([, candidate]) => (candidate.curriculumIds ?? []).length > 0,
        );
        test.skip(
            !parented,
            "no syllabus is linked to a curriculum to compare against",
        );

        const [syllabusId, entry] = parented!;
        const originalParents = entry.curriculumIds;

        // Find a curriculum this syllabus is *not* already linked to.
        const curriculumsResponse = await request.get("/api/gantt/curriculums");
        const { data: curriculums } = await curriculumsResponse.json();
        const otherCurriculumId = Object.keys(curriculums).find(
            (id) => !originalParents.includes(id),
        );
        test.skip(!otherCurriculumId, "need a second curriculum to share into");

        const linkResponse = await request.post(
            `/api/gantt/syllabuses/${syllabusId}/link`,
            { data: { newParentId: otherCurriculumId } },
        );
        expect(linkResponse.ok()).toBeTruthy();

        try {
            const expected = [...originalParents, otherCurriculumId!].sort();

            // Read twice: the junction query has no ORDER BY, so a missing
            // sort in the db layer shows up as an unstable order here.
            for (let attempt = 0; attempt < 2; attempt++) {
                const check = await request.get(
                    "/api/gantt/syllabuses?withParents=1",
                );
                const { data } = await check.json();
                expect(data[syllabusId].curriculumIds).toEqual(expected);
            }

            // getItem must agree with listItems.
            const itemResponse = await request.get(
                `/api/gantt/syllabuses/${syllabusId}`,
            );
            const { data: item } = await itemResponse.json();
            expect(item.curriculumIds).toEqual(expected);
        } finally {
            // Always unlink, so a failure here cannot leave the dev/CI data
            // permanently altered for later tests.
            await request.delete(
                `/api/gantt/syllabuses/${syllabusId}/link`,
                { data: { oldParentId: otherCurriculumId } },
            );
        }

        const restored = await request.get(
            "/api/gantt/syllabuses?withParents=1",
        );
        const { data: restoredData } = await restored.json();
        expect(restoredData[syllabusId].curriculumIds).toEqual(
            originalParents,
        );
    });
});
