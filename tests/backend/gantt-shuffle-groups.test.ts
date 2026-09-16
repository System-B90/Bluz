import { describe, expect, it } from "vitest";

import { NormalizedStore } from "@/api-client/gantt/drizzle-normalize";
import {
    GanttModule,
    GanttSyllabus,
} from "@/api-shared/types/gantt/models";
import {
    calculateMinimumRequiredTimeForModule,
    calculateMinimumRequiredTimeForSyllabus,
    getSyllabusShuffleTotals,
    sumCollapsingShuffleGroups,
} from "@/components/gantt/utils";

/**
 * Shuffle groups (#699): the same lesson held once per shuffle is stored as one
 * event per shuffle. A module's required time must therefore take the longest
 * member of a group, never the sum of its members - otherwise every lesson a
 * syllabus splits across N shuffles inflates the curriculum N-fold.
 */
function event(
    id: string,
    minimumDuration: number,
    extra: Record<string, unknown> = {},
) {
    return {
        id,
        title: "שיעור",
        minimumDuration,
        allocatedDuration: 0,
        recurrence: "none",
        constraints: [],
        shuffles: [],
        groupId: null,
        ...extra,
    };
}

function storeOf(events: Array<ReturnType<typeof event>>): NormalizedStore {
    return {
        curriculums: {},
        syllabuses: {},
        modules: {},
        events: Object.fromEntries(events.map((e) => [ e.id, e ])),
        weeks: {},
        days: {},
    } as unknown as NormalizedStore;
}

const moduleOf = (eventIds: Array<string>, shuffles: Array<string> = []) =>
    ({ id: "m1", title: "מערך", events: eventIds, shuffles } as unknown as GanttModule);

describe("module time with shuffle groups", () => {
    it("counts a grouped lesson once, at its longest shuffle", () => {
        const store = storeOf([
            event("e1", 60, { groupId: "g1", shuffles: [ "ניצה" ] }),
            event("e2", 90, { groupId: "g1", shuffles: [ "לחם" ] }),
        ]);

        expect(
            calculateMinimumRequiredTimeForModule(moduleOf([ "e1", "e2" ]), store),
        ).toBe(90);
    });

    it("still sums two separate lessons that merely share a shuffle", () => {
        const store = storeOf([
            event("e1", 60, { shuffles: [ "ניצה" ] }),
            event("e2", 90, { shuffles: [ "ניצה" ] }),
        ]);

        expect(
            calculateMinimumRequiredTimeForModule(moduleOf([ "e1", "e2" ]), store),
        ).toBe(150);
    });

    it("adds an untagged lesson on top of the longest group member", () => {
        // The untagged event applies to every shuffle, so it lands in both
        // per-shuffle totals and the larger of the two wins.
        const store = storeOf([
            event("e1", 60, { groupId: "g1", shuffles: [ "ניצה" ] }),
            event("e2", 90, { groupId: "g1", shuffles: [ "לחם" ] }),
            event("e3", 30),
        ]);

        expect(
            calculateMinimumRequiredTimeForModule(
                moduleOf([ "e1", "e2", "e3" ]),
                store,
            ),
        ).toBe(120);
    });
});

describe("syllabus time with shuffle groups", () => {
    const syllabus = {
        id: "s1",
        title: "מקצוע",
        modules: [ "m1" ],
        shuffles: [ "ניצה", "לחם" ],
    } as unknown as GanttSyllabus;

    it("reports each shuffle its own total and charges the longest one", () => {
        const store = storeOf([
            event("e1", 60, { groupId: "g1", shuffles: [ "ניצה" ] }),
            event("e2", 90, { groupId: "g1", shuffles: [ "לחם" ] }),
        ]);
        store.modules.m1 = moduleOf([ "e1", "e2" ]) as never;

        expect(getSyllabusShuffleTotals(syllabus, "minimumDuration", store)).toEqual({
            ניצה: 60,
            לחם: 90,
        });
        expect(calculateMinimumRequiredTimeForSyllabus(syllabus, store)).toBe(90);
    });
});

describe("sumCollapsingShuffleGroups", () => {
    it("sums ungrouped entries and collapses grouped ones to their maximum", () => {
        const store = storeOf([
            event("e1", 0, { groupId: "g1" }),
            event("e2", 0, { groupId: "g1" }),
            event("e3", 0),
        ]);

        expect(
            sumCollapsingShuffleGroups(
                [
                    { eventId: "e1", minutes: 60 },
                    { eventId: "e2", minutes: 90 },
                    { eventId: "e3", minutes: 30 },
                ],
                store,
            ),
        ).toBe(120);
    });

    it("treats an event missing from the store as ungrouped", () => {
        expect(
            sumCollapsingShuffleGroups(
                [ { eventId: "gone", minutes: 45 } ],
                storeOf([]),
            ),
        ).toBe(45);
    });
});
