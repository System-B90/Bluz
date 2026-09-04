import { describe, expect, it } from "vitest";

import { NormalizedStore } from "@/api-client/gantt/drizzle-normalize";
import { Action } from "@/components/gantt/state/reducers/actions";
import { curriculumDomainReducer } from "@/components/gantt/state/reducers/curriculum-reducer";
import { injectDocumentTimes } from "@/components/gantt/state/reducers/inject-document-times";
import { syllabusDomainReducer } from "@/components/gantt/state/reducers/syllabus-reducer";
import { weekDomainReducer } from "@/components/gantt/state/reducers/week-reducer";

/**
 * The gantt store's domain reducers. They are pure, and every "if the parent
 * is missing, return state untouched" branch is exactly the kind of thing an
 * e2e run never reaches — a stale dispatch after a purge — so each one is
 * pinned here.
 */
function store(overrides: Partial<NormalizedStore> = {}): NormalizedStore {
    return {
        curriculums: {
            c1: {
                id: "c1",
                title: "גאנט",
                syllabuses: [ "s1" ],
                weeks: [ "w1" ],
            },
        },
        syllabuses: { s1: { id: "s1", title: "סילבוס", modules: [ "m1" ], curriculumId: "c1" } },
        modules: { m1: { id: "m1", title: "מודול", events: [ "e1" ], syllabusId: "s1" } },
        events: { e1: { id: "e1", title: "אירוע", moduleId: "m1" } },
        weeks: { w1: { id: "w1", number: 1, days: [ "d1" ], curriculumId: "c1" } },
        days: { d1: { id: "d1", dayIndex: 0 } },
        ...overrides,
    } as unknown as NormalizedStore;
}

const asAction = <T>(action: T) => action as unknown as Action;

describe("injectDocumentTimes", () => {
    it("stamps createdAt/updatedAt without touching the original", () => {
        const raw = { id: "x", title: "t" } as never;

        const doc = injectDocumentTimes(raw);

        expect(doc.createdAt).toBeDefined();
        expect(doc.updatedAt).toBeDefined();
        expect(raw).not.toHaveProperty("createdAt");
    });
});

describe("curriculumDomainReducer", () => {
    it("UPDATE_CURRICULUM merges the updates", () => {
        const next = curriculumDomainReducer(
            store(),
            asAction({
                type: "UPDATE_CURRICULUM",
                payload: { id: "c1", updates: { title: "חדש" } },
            }) as never,
        );

        const before = store();
        expect(next.curriculums.c1.title).toBe("חדש");
        expect(next.curriculums.c1.syllabuses).toEqual([ "s1" ]);
        // Only the curriculums slice is rebuilt — the rest keeps its identity.
        expect(next.syllabuses).toEqual(before.syllabuses);
    });

    it("UPDATE_CURRICULUM on an unknown id is a no-op", () => {
        const before = store();

        const next = curriculumDomainReducer(
            before,
            asAction({
                type: "UPDATE_CURRICULUM",
                payload: { id: "missing", updates: { title: "x" } },
            }) as never,
        );

        expect(next).toBe(before);
    });
});

describe("weekDomainReducer", () => {
    it("ADD_WEEK stores the week and appends it to its curriculum", () => {
        const next = weekDomainReducer(
            store(),
            asAction({
                type: "ADD_WEEK",
                payload: {
                    curriculumId: "c1",
                    week: { id: "w2", number: 2, days: [] },
                },
            }) as never,
        );

        expect(next.weeks.w2.curriculumId).toBe("c1");
        expect(next.weeks.w2.createdAt).toBeDefined();
        expect(next.curriculums.c1.weeks).toEqual([ "w1", "w2" ]);
    });

    it("ADD_WEEK for an unknown curriculum is a no-op", () => {
        const before = store();

        expect(
            weekDomainReducer(
                before,
                asAction({
                    type: "ADD_WEEK",
                    payload: { curriculumId: "nope", week: { id: "w2" } },
                }) as never,
            ),
        ).toBe(before);
    });

    it("UPDATE_WEEK merges updates, and skips an unknown week", () => {
        const before = store();

        const next = weekDomainReducer(
            before,
            asAction({
                type: "UPDATE_WEEK",
                payload: { id: "w1", updates: { comment: "הערה" } },
            }) as never,
        );
        expect(
            (next.weeks.w1 as unknown as { comment: string }).comment,
        ).toBe("הערה");
        expect(next.weeks.w1.number).toBe(1);

        expect(
            weekDomainReducer(
                before,
                asAction({
                    type: "UPDATE_WEEK",
                    payload: { id: "wX", updates: { comment: "x" } },
                }) as never,
            ),
        ).toBe(before);
    });

    it("REMOVE_WEEK drops the week, its days, and the curriculum reference", () => {
        const next = weekDomainReducer(
            store(),
            asAction({
                type: "REMOVE_WEEK",
                payload: { curriculumId: "c1", weekId: "w1" },
            }) as never,
        );

        expect(next.weeks.w1).toBeUndefined();
        expect(next.days.d1).toBeUndefined();
        expect(next.curriculums.c1.weeks).toEqual([]);
    });

    it("REMOVE_WEEK survives a week that is already gone", () => {
        const next = weekDomainReducer(
            store(),
            asAction({
                type: "REMOVE_WEEK",
                payload: { curriculumId: "c1", weekId: "wX" },
            }) as never,
        );

        expect(next.weeks.w1).toBeDefined();
        expect(next.days.d1).toBeDefined();
        expect(next.curriculums.c1.weeks).toEqual([ "w1" ]);
    });
});

describe("syllabusDomainReducer", () => {
    it("ADD_SYLLABUS links the new syllabus to its curriculum", () => {
        const next = syllabusDomainReducer(
            store(),
            asAction({
                type: "ADD_SYLLABUS",
                payload: {
                    curriculumId: "c1",
                    syllabus: { id: "s2", title: "חדש", modules: [] },
                },
            }) as never,
        );

        expect(next.syllabuses.s2.curriculumId).toBe("c1");
        expect(next.curriculums.c1.syllabuses).toEqual([ "s1", "s2" ]);
    });

    it("MERGE_SYLLABUS folds in the whole subtree at once (#320)", () => {
        const next = syllabusDomainReducer(
            store(),
            asAction({
                type: "MERGE_SYLLABUS",
                payload: {
                    curriculumId: "c1",
                    syllabus: { id: "s2", title: "מקושר", modules: [ "m2" ] },
                    modules: [ { id: "m2", title: "מודול", events: [ "e2" ] } ],
                    events: [ { id: "e2", title: "אירוע" } ],
                },
            }) as never,
        );

        expect(next.syllabuses.s2.modules).toEqual([ "m2" ]);
        expect(next.modules.m2).toBeDefined();
        expect(next.events.e2).toBeDefined();
        // Existing entries survive the merge.
        expect(next.modules.m1).toBeDefined();
        expect(next.curriculums.c1.syllabuses).toEqual([ "s1", "s2" ]);
    });

    it("MERGE_SYLLABUS does not duplicate an already-linked syllabus", () => {
        const next = syllabusDomainReducer(
            store(),
            asAction({
                type: "MERGE_SYLLABUS",
                payload: {
                    curriculumId: "c1",
                    syllabus: { id: "s1", title: "סילבוס", modules: [ "m1" ] },
                    modules: [],
                    events: [],
                },
            }) as never,
        );

        expect(next.curriculums.c1.syllabuses).toEqual([ "s1" ]);
    });

    it("REMOVE_SYLLABUS unlinks it from the curriculum only", () => {
        const next = syllabusDomainReducer(
            store(),
            asAction({
                type: "REMOVE_SYLLABUS",
                payload: { curriculumId: "c1", syllabusId: "s1" },
            }) as never,
        );

        expect(next.curriculums.c1.syllabuses).toEqual([]);
        // A syllabus is shareable, so its document stays in the store.
        expect(next.syllabuses.s1).toBeDefined();
    });

    it("REORDER_MODULES replaces the module order", () => {
        const before = store({
            syllabuses: {
                s1: {
                    id: "s1",
                    title: "סילבוס",
                    modules: [ "m1", "m2" ],
                    curriculumId: "c1",
                },
            },
        } as unknown as Partial<NormalizedStore>);

        const next = syllabusDomainReducer(
            before,
            asAction({
                type: "REORDER_MODULES",
                payload: { syllabusId: "s1", moduleIds: [ "m2", "m1" ] },
            }) as never,
        );

        expect(next.syllabuses.s1.modules).toEqual([ "m2", "m1" ]);
    });

    it("every branch ignores a payload pointing at a missing parent", () => {
        const before = store();
        const noops = [
            { type: "UPDATE_SYLLABUS", payload: { id: "sX", updates: {} } },
            {
                type: "ADD_SYLLABUS",
                payload: { curriculumId: "cX", syllabus: { id: "s9" } },
            },
            {
                type: "MERGE_SYLLABUS",
                payload: {
                    curriculumId: "cX",
                    syllabus: { id: "s9" },
                    modules: [],
                    events: [],
                },
            },
            {
                type: "REMOVE_SYLLABUS",
                payload: { curriculumId: "cX", syllabusId: "s1" },
            },
            {
                type: "REORDER_MODULES",
                payload: { syllabusId: "sX", moduleIds: [] },
            },
        ];

        for (const action of noops) {
            expect(syllabusDomainReducer(before, asAction(action) as never)).toBe(
                before,
            );
        }
    });
});
