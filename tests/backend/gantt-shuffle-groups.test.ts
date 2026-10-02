import { describe, expect, it } from "vitest";

import { NormalizedStore } from "@/api-client/gantt/drizzle-normalize";
import { Course } from "@/api-shared/types/course";
import { GanttSyllabus } from "@/api-shared/types/gantt/models";
import {
    calculateStudentModuleMinutes,
    calculateStudentSyllabusMinutes,
} from "@/components/gantt/curriculum-view/student-load";
import { getSyllabusShuffleTotals } from "@/components/gantt/utils";

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
        recurrence: "none",
        constraints: [],
        shuffles: [],
        groupId: null,
        courseIds: [] as Array<string>,
        ...extra,
    };
}

const COURSES: Array<Course> = [
    { id: "bis", name: "ביס90", color: null, parentId: null },
    { id: "apollo", name: "אפולו", color: null, parentId: "bis" },
    { id: "sphinx", name: "ספינקס", color: null, parentId: "bis" },
];

/** Syllabus s1 (shuffles ניצה/לחם, no course ⇒ everyone) with module m1. */
function storeOf(events: Array<ReturnType<typeof event>>): NormalizedStore {
    return {
        curriculums: {},
        syllabuses: {
            s1: { id: "s1", title: "מקצוע", modules: [ "m1" ], shuffles: [ "ניצה", "לחם" ], courseIds: [] },
        },
        modules: {
            m1: { id: "m1", title: "מערך", syllabusId: "s1", shuffles: [], events: events.map((e) => e.id) },
        },
        events: Object.fromEntries(events.map((e) => [ e.id, { ...e, moduleId: "m1", courseIds: e.courseIds ?? [] } ])),
        weeks: {},
        days: {},
    } as unknown as NormalizedStore;
}

const moduleMinutes = (store: NormalizedStore) => calculateStudentModuleMinutes("m1", store, COURSES);

describe("module time with shuffle groups", () => {
    it("counts a grouped lesson once, at its longest shuffle", () => {
        const store = storeOf([
            event("e1", 60, { groupId: "g1", shuffles: [ "ניצה" ] }),
            event("e2", 90, { groupId: "g1", shuffles: [ "לחם" ] }),
        ]);

        expect(moduleMinutes(store)).toBe(90);
    });

    it("still sums two separate lessons that merely share a shuffle", () => {
        const store = storeOf([
            event("e1", 60, { shuffles: [ "ניצה" ] }),
            event("e2", 90, { shuffles: [ "ניצה" ] }),
        ]);

        expect(moduleMinutes(store)).toBe(150);
    });

    it("adds an untagged lesson on top of the longest group member", () => {
        // The untagged event applies to every shuffle, so it lands in both
        // per-shuffle totals and the larger of the two wins.
        const store = storeOf([
            event("e1", 60, { groupId: "g1", shuffles: [ "ניצה" ] }),
            event("e2", 90, { groupId: "g1", shuffles: [ "לחם" ] }),
            event("e3", 30),
        ]);

        expect(moduleMinutes(store)).toBe(120);
    });
});

describe("module time with course-limited events", () => {
    it("runs events for mutually exclusive courses in parallel", () => {
        const store = storeOf([
            event("e1", 60, { courseIds: [ "apollo" ] }),
            event("e2", 60, { courseIds: [ "sphinx" ] }),
        ]);

        expect(moduleMinutes(store)).toBe(60);
    });

    it("adds a course-limited event on top of the whole-syllabus ones", () => {
        const store = storeOf([
            event("e1", 60, { courseIds: [ "apollo" ] }),
            event("e2", 30),
        ]);

        expect(moduleMinutes(store)).toBe(90);
    });
});

describe("syllabus time with shuffle groups", () => {
    it("reports each shuffle its own total and charges the longest one", () => {
        const store = storeOf([
            event("e1", 60, { groupId: "g1", shuffles: [ "ניצה" ] }),
            event("e2", 90, { groupId: "g1", shuffles: [ "לחם" ] }),
        ]);
        const syllabus = store.syllabuses.s1 as unknown as GanttSyllabus;

        expect(getSyllabusShuffleTotals(syllabus, "minimumDuration", store)).toEqual({
            ניצה: 60,
            לחם: 90,
        });
        expect(calculateStudentSyllabusMinutes("s1", store, COURSES)).toBe(90);
    });
});

describe("shuffle totals with course-limited events", () => {
    it("leaves course-limited events out of every shuffle's total", () => {
        const store = storeOf([
            event("e1", 60, { groupId: "g1", shuffles: [ "ניצה" ] }),
            event("e2", 60, { groupId: "g1", shuffles: [ "לחם" ] }),
            event("e3", 180, { courseIds: [ "apollo" ] }),
        ]);
        const syllabus = store.syllabuses.s1 as unknown as GanttSyllabus;

        expect(getSyllabusShuffleTotals(syllabus, "minimumDuration", store)).toEqual({
            ניצה: 60,
            לחם: 60,
        });
    });
});
