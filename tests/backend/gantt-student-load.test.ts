import { describe, expect, it } from "vitest";

import { NormalizedStore } from "@/api-client/gantt/drizzle-normalize";
import { SHUFFLE_COURSE_DESCRIPTION_PREFIX } from "@/api-shared/course-tree";
import { Course } from "@/api-shared/types/course";
import { EventRecurrence } from "@/api-shared/types/gantt/models";
import {
    buildStudentPaths,
    calculateStudentMinutes,
    computeStudentSchedule,
    sumStudentMinutes,
} from "@/components/gantt/curriculum-view/student-load";

/*
 * Bis90 splits into Apollo and Sphinx. Math is everyone's and split into two
 * shuffles that run the same 3-hour block with different lessons; physics is
 * Apollo's and chemistry Sphinx's, so those two run in parallel.
 */
const COURSES: Array<Course> = [
    { id: "bis", name: "ביס90", color: null, parentId: null },
    { id: "apollo", name: "אפולו", color: null, parentId: "bis" },
    { id: "sphinx", name: "ספינקס", color: null, parentId: "bis" },
    {
        id: "beg-course",
        name: "מתחילים",
        color: null,
        parentId: "bis",
        description: `${SHUFFLE_COURSE_DESCRIPTION_PREFIX} "מתמטיקה"`,
    },
];

type EventSpec = {
    minutes: number;
    shuffles?: Array<string>;
    courseIds?: Array<string>;
    recurrence?: EventRecurrence;
};

function store(
    eventsBySyllabus: Record<string, Record<string, EventSpec>>,
    capacity = 480,
): NormalizedStore {
    const syllabusDefs: Record<string, { courseIds: Array<string>; shuffles: Array<string> }> = {
        math: { courseIds: [], shuffles: [ "מתחילים", "מתקדמים" ] },
        phys: { courseIds: [ "apollo" ], shuffles: [] },
        chem: { courseIds: [ "sphinx" ], shuffles: [] },
    };
    const syllabuses: Record<string, unknown> = {};
    const modules: Record<string, unknown> = {};
    const events: Record<string, unknown> = {};
    for (const [ syllabusId, def ] of Object.entries(syllabusDefs)) {
        const moduleId = `${syllabusId}-m`;
        const eventIds = Object.keys(eventsBySyllabus[ syllabusId ] ?? {});
        syllabuses[ syllabusId ] = { id: syllabusId, title: syllabusId, modules: [ moduleId ], ...def };
        modules[ moduleId ] = { id: moduleId, syllabusId, events: eventIds, shuffles: [] };
        for (const [ eventId, spec ] of Object.entries(eventsBySyllabus[ syllabusId ] ?? {})) {
            events[ eventId ] = {
                id: eventId,
                moduleId,
                minimumDuration: spec.minutes,
                shuffles: spec.shuffles ?? [],
                courseIds: spec.courseIds ?? [],
                recurrence: spec.recurrence ?? EventRecurrence.None,
                recurrenceStartDate: null,
                recurrenceEndDate: null,
                constraints: [],
                groupId: null,
                splitAcrossWeeks: false,
            };
        }
    }
    return {
        syllabuses,
        modules,
        events,
        weeks: { w1: { id: "w1", days: [ "d1", "d2", "d3" ] } },
        days: {
            d1: { id: "d1", dayIndex: 0, totalWorkingMinutes: capacity },
            d2: { id: "d2", dayIndex: 1, totalWorkingMinutes: capacity },
            d3: { id: "d3", dayIndex: 2, totalWorkingMinutes: capacity },
        },
    } as unknown as NormalizedStore;
}

/** Every event placed on `dayId`, in declaration order. */
function placeAll(state: NormalizedStore, dayId = "d1") {
    return Object.fromEntries(
        Object.keys(state.events).map((eventId, sortOrder) => [
            eventId,
            { curriculumId: "c", moduleId: state.events[ eventId ].moduleId, eventId, dayId, sortOrder },
        ]),
    );
}

function schedule(state: NormalizedStore, mappings = placeAll(state)) {
    return computeStudentSchedule({
        courses: COURSES,
        exceptions: {},
        linearDays: [ "d1", "d2", "d3" ],
        mappings,
        state,
        syllabusIds: [ "math", "phys", "chem" ],
    });
}

const ALIGNED_MATH: Record<string, EventSpec> = {
    begLecture: { minutes: 60, shuffles: [ "מתחילים" ] },
    begExercise: { minutes: 120, shuffles: [ "מתחילים" ] },
    advSelf: { minutes: 30, shuffles: [ "מתקדמים" ] },
    advExercise: { minutes: 120, shuffles: [ "מתקדמים" ] },
    advLecture: { minutes: 30, shuffles: [ "מתקדמים" ] },
};

describe("buildStudentPaths", () => {
    it("splits the root into all its sub-courses and skips shuffle courses", () => {
        const paths = buildStudentPaths(COURSES, [ "apollo" ], true);

        expect(paths.map((path) => path.label)).toEqual([ "אפולו", "ספינקס" ]);
        expect(paths[ 0 ].courseIds).toEqual([ "bis", "apollo" ]);
    });

    it("falls back to one all-students path without courses", () => {
        expect(buildStudentPaths([], [], true)).toEqual([
            { id: "all", courseIds: [], label: "כל החניכים" },
        ]);
    });
});

describe("computeStudentSchedule", () => {
    it("counts a syllabus' shuffles once and exclusive courses in parallel", () => {
        const result = schedule(store({
            math: ALIGNED_MATH,
            phys: { phys: { minutes: 120 } },
            chem: { chem: { minutes: 240 } },
        }));

        const day = result.byDay.d1;
        expect(Object.fromEntries(day.paths.map((path) => [ path.pathId, path.minutes ]))).toEqual({
            apollo: 180 + 120,
            sphinx: 180 + 240,
        });
        expect(day.minutes).toBe(420);
        expect(day.issues).toEqual([]);
    });

    it("flags shuffles whose block lengths differ", () => {
        const { advLecture: _dropped, ...misaligned } = ALIGNED_MATH;
        const result = schedule(store({ math: misaligned }));

        expect(result.byDay.d1.minutes).toBe(180);
        expect(result.byDay.d1.issues).toContainEqual({
            kind: "shuffles-misaligned",
            syllabusId: "math",
            minutesByShuffle: { "מתחילים": 180, "מתקדמים": 150 },
        });
    });

    it("counts a course-limited event only on its course's path", () => {
        const result = schedule(store({
            math: { ...ALIGNED_MATH, apolloOnly: { minutes: 120, courseIds: [ "apollo" ] } },
            phys: { phys: { minutes: 120 } },
            chem: { chem: { minutes: 240 } },
        }));

        expect(result.byDay.d1.paths.map((path) => path.minutes)).toEqual([ 420, 420 ]);
        expect(result.byDay.d1.issues).toEqual([]);
    });

    it("never spills an over-full day onto the next — it shows as overloaded", () => {
        const result = schedule(store({
            math: ALIGNED_MATH,
            phys: { phys: { minutes: 120 } },
            chem: { chem: { minutes: 240 }, chemMore: { minutes: 120 } },
        }));

        expect(result.spans.chemMore).toEqual({ dayIds: [ "d1" ], minutesPerDay: [ 120 ], spillover: false });
        expect(result.byDay.d2).toBeUndefined();
    });

    it("lets parallel shuffles share the day without spilling", () => {
        const result = schedule(store({ math: ALIGNED_MATH }, 200));

        expect(result.spans.advLecture).toMatchObject({ dayIds: [ "d1" ], spillover: false });
        expect(result.byDay.d1.minutes).toBe(180);
    });

    it("counts a recurring event on every occurrence", () => {
        const result = schedule(store({ math: { daily: { minutes: 45, recurrence: EventRecurrence.Daily } } }));

        expect([ "d1", "d2", "d3" ].map((dayId) => result.byDay[ dayId ]?.minutes)).toEqual([ 45, 45, 45 ]);
        expect(sumStudentMinutes(result.byDay, [ "d1", "d2", "d3" ])).toBe(135);
    });
});

describe("calculateStudentMinutes", () => {
    it("takes the busiest path, each syllabus at its longest shuffle", () => {
        const state = store({
            math: ALIGNED_MATH,
            phys: { phys: { minutes: 120 } },
            chem: { chem: { minutes: 240 } },
        });

        expect(calculateStudentMinutes({
            courses: COURSES,
            state,
            syllabusIds: [ "math", "phys", "chem" ],
        })).toBe(420);
    });
});
