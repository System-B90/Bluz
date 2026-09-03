import { describe, expect, it } from "vitest";

import { NormalizedStore } from "@/api-client/gantt/drizzle-normalize";
import { curriculumReducer } from "@/components/gantt/state/reducer";

/**
 * PURGE_ENTITY has to remove the container's reference too, not just the doc.
 *
 * #381 made module/syllabus/event creation optimistic: dispatch a temp entity,
 * await the API, then discard the temp and add the real one. `ADD_MODULE`
 * appends the id to `syllabus.modules`, so a purge that deletes only
 * `state.modules[tempId]` leaves that id dangling in the parent's list.
 *
 * Every consumer that maps ids back to docs then gets `undefined`.
 * `module-dialog/index.tsx` does exactly that — `siblingModules` maps
 * `syllabus.modules` through `state.modules`, and the render does `m.id` —
 * so the module dialog threw on render and never appeared. That took out all
 * 12 gantt e2e specs at once, every one of them failing in
 * `createModuleWithEvents` waiting for a dialog that could not mount (#495).
 *
 * These assert the invariant directly: after a purge, no container may still
 * reference the purged id.
 */

function makeStore(): NormalizedStore {
    return {
        curriculums: {
            "cur-1": {
                id: "cur-1",
                title: "תוכנית",
                description: "",
                syllabuses: [ "syl-1" ],
                weeks: [],
                isDraft: true,
                isArchived: false,
                startDate: null,
            },
        },
        syllabuses: {
            "syl-1": {
                id: "syl-1",
                title: "סילבוס",
                hiveIds: [],
                modules: [ "mod-real", "mod-temp" ],
                curriculumId: "cur-1",
            },
        },
        modules: {
            "mod-real": {
                id: "mod-real",
                title: "מערך",
                description: "",
                hiveIds: [],
                events: [ "ev-real", "ev-temp" ],
                syllabusId: "syl-1",
                constraints: [],
            },
            "mod-temp": {
                id: "mod-temp",
                title: "מערך זמני",
                description: "",
                hiveIds: [],
                events: [],
                syllabusId: "syl-1",
                constraints: [],
            },
        },
        events: {
            "ev-real": { id: "ev-real", title: "מופע", moduleId: "mod-real" },
            "ev-temp": {
                id: "ev-temp",
                title: "מופע זמני",
                moduleId: "mod-real",
            },
        },
        weeks: {},
        days: {},
    } as unknown as NormalizedStore;
}

describe("PURGE_ENTITY drops the container reference too (#495)", () => {
    it("removes a purged module from its syllabus", () => {
        const next = curriculumReducer(makeStore(), {
            type: "PURGE_ENTITY",
            payload: { collection: "modules", id: "mod-temp" },
        } as never);

        expect(next.modules["mod-temp"]).toBeUndefined();
        expect(
            next.syllabuses["syl-1"]!.modules,
            "the purged module id is still listed on its syllabus, so anything mapping ids to docs gets undefined",
        ).toEqual([ "mod-real" ]);
    });

    it("removes a purged event from its module", () => {
        const next = curriculumReducer(makeStore(), {
            type: "PURGE_ENTITY",
            payload: { collection: "events", id: "ev-temp" },
        } as never);

        expect(next.events["ev-temp"]).toBeUndefined();
        expect(next.modules["mod-real"]!.events).toEqual([ "ev-real" ]);
    });

    it("removes a purged syllabus from its curriculum", () => {
        const next = curriculumReducer(makeStore(), {
            type: "PURGE_ENTITY",
            payload: { collection: "syllabuses", id: "syl-1" },
        } as never);

        expect(next.syllabuses["syl-1"]).toBeUndefined();
        expect(next.curriculums["cur-1"]!.syllabuses).toEqual([]);
    });

    it("leaves every id resolvable after an optimistic create round trip", () => {
        // The exact sequence CreateModuleButton drives: optimistic add, then
        // discard the temp and add the real one once the API answers.
        const store = makeStore();
        const afterOptimistic = curriculumReducer(store, {
            type: "ADD_MODULE",
            payload: {
                syllabusId: "syl-1",
                module: {
                    id: "temp-module-1",
                    title: "מערך חדש",
                    description: "",
                    hiveIds: [],
                    events: [],
                    constraints: [],
                },
            },
        } as never);
        const afterPurge = curriculumReducer(afterOptimistic, {
            type: "PURGE_ENTITY",
            payload: { collection: "modules", id: "temp-module-1" },
        } as never);

        const dangling = afterPurge.syllabuses["syl-1"]!.modules.filter(
            (id) => !afterPurge.modules[id],
        );
        expect(
            dangling,
            "syllabus.modules still references ids with no document; module-dialog renders m.id over these and throws",
        ).toEqual([]);
    });

    it("is a no-op for an id that is not in the store", () => {
        const store = makeStore();
        expect(
            curriculumReducer(store, {
                type: "PURGE_ENTITY",
                payload: { collection: "modules", id: "nope" },
            } as never),
        ).toBe(store);
    });
});
