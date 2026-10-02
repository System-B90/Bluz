import { describe, expect, it } from "vitest";

import { NormalizedStore } from "@/api-client/gantt/drizzle-normalize";
import { EventRecurrence } from "@/api-shared/types/gantt/models";
import { MEAL_BREAKS_SYLLABUS_TITLE } from "@/api-shared/types/settings/meal";
import {
    calculateStudentModuleMinutes,
    computeStudentSchedule,
    withoutBreaks,
} from "@/components/gantt/curriculum-view/student-load";
import { countEventOccurrences } from "@/components/gantt/utils";

/** "work" syllabus: 180 min lesson. "breaks" syllabus: 60 min break. Both mapped to d1. */
function setup() {
    const state = {
        days: { d1: { id: "d1", dayIndex: 0 }, d2: { id: "d2", dayIndex: 1 } },
        syllabuses: {
            work: { id: "work", title: "work", modules: [ "wm" ], courseIds: [], shuffles: [] },
            breaks: { id: "breaks", title: MEAL_BREAKS_SYLLABUS_TITLE, modules: [ "bm" ], courseIds: [], shuffles: [] },
        },
        modules: {
            wm: { id: "wm", syllabusId: "work", events: [ "lesson" ], shuffles: [] },
            bm: { id: "bm", syllabusId: "breaks", events: [ "lunch" ], shuffles: [] },
        },
        events: {
            lesson: { id: "lesson", title: "lesson", minimumDuration: 180, recurrence: EventRecurrence.None },
            lunch: { id: "lunch", title: "lunch", minimumDuration: 60, recurrence: EventRecurrence.None },
        },
    } as unknown as NormalizedStore;
    const mappings = {
        m1: { id: "m1", curriculumId: "c", moduleId: "wm", eventId: "lesson", dayId: "d1", allottedMinutes: 180 },
        m2: { id: "m2", curriculumId: "c", moduleId: "bm", eventId: "lunch", dayId: "d1", allottedMinutes: 60 },
    } as never;
    return { state, mappings };
}

describe("ignore breaks (#800)", () => {
    it("takes break time out of each day's load", () => {
        const { state, mappings } = setup();
        const { byDay } = computeStudentSchedule({
            courses: [], exceptions: {}, linearDays: [ "d1", "d2" ], mappings, state, syllabusIds: [ "work", "breaks" ],
        });
        expect(byDay.d1.minutes).toBe(240);
        expect(byDay.d1.breakMinutes).toBe(60);
        const trimmed = withoutBreaks(byDay);
        expect(trimmed.d1.minutes).toBe(180);
        expect(trimmed.d1.paths[ 0 ].minutes).toBe(180);
    });

    it("drops a break module's own time", () => {
        const { state } = setup();
        expect(calculateStudentModuleMinutes("bm", state, [])).toBe(60);
        expect(calculateStudentModuleMinutes("bm", state, [], undefined, true)).toBe(0);
    });
});

describe("module time this week (#799)", () => {
    it("counts only occurrences on the given days", () => {
        const { state, mappings } = setup();
        const ctx = { mappings, exceptions: {}, linearDays: [ "d1", "d2" ] };
        const lesson = state.events.lesson;
        expect(countEventOccurrences(lesson, "lesson", state, ctx)).toBe(1);
        expect(countEventOccurrences(lesson, "lesson", state, { ...ctx, onlyDayIds: new Set([ "d1" ]) })).toBe(1);
        expect(countEventOccurrences(lesson, "lesson", state, { ...ctx, onlyDayIds: new Set([ "d2" ]) })).toBe(0);
    });
});
