import { afterEach, describe, expect, it } from "vitest";

import { NormalizedStore } from "@/api-client/gantt/drizzle-normalize";
import { EventRecurrence } from "@/api-shared/types/gantt/models";
import { buildGridRows, GridPlacement } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/grid-rows";
import { formatHours, setHoursFormat } from "@/components/gantt/curriculum-view/gantt-time-utils";
import { countRequiredOccurrences } from "@/components/gantt/utils";

/**
 * Spreadsheet grid tab: per-week event hours, summary sums, and required
 * time = duration x required recurrence occurrences.
 */

const WEEKS = [ [ "a1", "a2" ], [ "b1", "b2" ], [ "c1", "c2" ] ];
const LINEAR_DAYS = WEEKS.flat();
const DATES: Record<string, string> = {
    a1: "2026-01-04", a2: "2026-01-05",
    b1: "2026-01-11", b2: "2026-01-12",
    c1: "2026-01-18", c2: "2026-01-19",
};
const WEEK_INDEX = new Map(WEEKS.flatMap((days, w) => days.map((dayId) => [ dayId, w ] as const)));

type EventInput = {
    minimumDuration: number;
    recurrence?: EventRecurrence;
    recurrenceStartDate?: string;
    recurrenceEndDate?: string;
};

function store(events: Record<string, EventInput>) {
    return {
        days: Object.fromEntries(LINEAR_DAYS.map((id) => [ id, { id, weekId: `w${id[0]}`, dayIndex: Number(id[1]) - 1 } ])),
        syllabuses: { s1: { id: "s1", title: "סילבוס", modules: [ "m1" ] } },
        modules: { m1: { id: "m1", title: "מודול", syllabusId: "s1", events: Object.keys(events) } },
        events: Object.fromEntries(
            Object.entries(events).map(([ id, e ]) => [
                id,
                { id, title: id, recurrence: EventRecurrence.None, recurrenceStartDate: null, recurrenceEndDate: null, ...e },
            ]),
        ),
    } as unknown as NormalizedStore;
}

function mappings(state: NormalizedStore, placed: Record<string, string>) {
    return Object.fromEntries(
        Object.entries(placed).map(([ eventId, dayId ]) => [
            eventId,
            { curriculumId: "c", moduleId: "m1", eventId, dayId, sortOrder: 0, allottedMinutes: state.events[ eventId ].minimumDuration ?? 0 },
        ]),
    );
}

function exceptions(skipped: Array<[ string, string ]>) {
    return Object.fromEntries(skipped.map(([ eventId, dayId ], i) => [ `x${i}`, { eventId, dayId } ]));
}

function placement(state: NormalizedStore, placed: Record<string, string>, skipped: Array<[ string, string ]> = []): GridPlacement {
    return {
        dateOf: (dayId) => DATES[ dayId ],
        eventSpans: Object.fromEntries(
            Object.entries(placed).map(([ eventId, dayId ]) => [
                eventId,
                { dayIds: [ dayId ], minutesPerDay: [ state.events[ eventId ].minimumDuration ?? 0 ], spillover: false },
            ]),
        ),
        exceptions: exceptions(skipped),
        linearDays: LINEAR_DAYS,
        mappings: mappings(state, placed),
        state,
        weekIndexByDayId: WEEK_INDEX,
        weeks: WEEKS,
    } as GridPlacement;
}

function required(event: EventInput, placed: Record<string, string> = {}, skipped: Array<[ string, string ]> = []) {
    const state = store({ e1: event });
    return countRequiredOccurrences(state.events.e1, "e1", state, placement(state, placed, skipped));
}

describe("countRequiredOccurrences", () => {
    it("requires a non-recurring event once", () => {
        expect(required({ minimumDuration: 60 })).toBe(1);
    });

    it("requires a weekly event once per timeline week, placed or not", () => {
        expect(required({ minimumDuration: 60, recurrence: EventRecurrence.Weekly })).toBe(3);
        expect(required({ minimumDuration: 60, recurrence: EventRecurrence.Weekly }, { e1: "c2" })).toBe(3);
    });

    it("limits occurrences to the recurrence window", () => {
        expect(required({
            minimumDuration: 60,
            recurrence: EventRecurrence.Weekly,
            recurrenceStartDate: "2026-01-11",
        }, { e1: "b2" })).toBe(2);
        expect(required({
            minimumDuration: 60,
            recurrence: EventRecurrence.Daily,
            recurrenceEndDate: "2026-01-11",
        })).toBe(3);
    });

    it("subtracts skipped occurrences", () => {
        expect(required({ minimumDuration: 60, recurrence: EventRecurrence.Weekly }, { e1: "a2" }, [ [ "e1", "b2" ] ])).toBe(2);
        expect(required({ minimumDuration: 60, recurrence: EventRecurrence.Daily }, { e1: "a1" }, [ [ "e1", "a2" ], [ "e1", "c1" ] ])).toBe(4);
    });

    it("ignores another event's skips", () => {
        expect(required({ minimumDuration: 60, recurrence: EventRecurrence.Weekly }, { e1: "a2" }, [ [ "e2", "b2" ] ])).toBe(3);
    });
});

describe("buildGridRows", () => {
    const state = store({
        e1: { minimumDuration: 120 },
        e2: { minimumDuration: 60, recurrence: EventRecurrence.Weekly },
        e3: { minimumDuration: 30 },
    });
    const grid = (expanded: boolean, skipped: Array<[ string, string ]> = []) =>
        buildGridRows([ "s1" ], placement(state, { e1: "a1", e2: "a2" }, skipped), () => expanded, () => expanded);

    it("puts each event's hours in its weeks, recurrence echoes included", () => {
        const rows = grid(true);
        expect(rows.map((r) => r.id)).toEqual([ "s1", "m1", "e1", "e2", "e3" ]);
        expect(rows.find((r) => r.id === "e1")?.weekMinutes).toEqual([ 120, 0, 0 ]);
        expect(rows.find((r) => r.id === "e2")?.weekMinutes).toEqual([ 60, 60, 60 ]);
        expect(rows.find((r) => r.id === "e3")?.weekMinutes).toEqual([ 0, 0, 0 ]);
    });

    it("sums children into summary rows", () => {
        const [ syllabus, module ] = grid(true);
        expect(module.weekMinutes).toEqual([ 180, 60, 60 ]);
        expect(syllabus.weekMinutes).toEqual([ 180, 60, 60 ]);
        expect(module.requiredMinutes).toBe(120 + 3 * 60 + 30);
        expect(syllabus.requiredMinutes).toBe(module.requiredMinutes);
    });

    it("drops a skipped occurrence from both its week and the required time", () => {
        const rows = grid(true, [ [ "e2", "b2" ] ]);
        const e2 = rows.find((r) => r.id === "e2");
        expect(e2?.weekMinutes).toEqual([ 60, 0, 60 ]);
        expect(e2?.requiredMinutes).toBe(120);
    });

    it("hides collapsed children but keeps their sums", () => {
        const rows = grid(false);
        expect(rows.map((r) => r.id)).toEqual([ "s1" ]);
        expect(rows[ 0 ].weekMinutes).toEqual([ 180, 60, 60 ]);
    });
});

describe("buildGridRows with shuffles", () => {
    const shuffled = () =>
    {
        const state = store({
            e1: { minimumDuration: 60 },
            e2: { minimumDuration: 30 },
            e3: { minimumDuration: 120 },
            e4: { minimumDuration: 15 },
        });
        Object.assign(state.syllabuses.s1, { title: "מתמטיקה", modules: [ "m1", "m2" ], shuffles: [ "מתחילים", "מתקדמים" ] });
        Object.assign(state.modules.m1, { events: [ "e1", "e2", "e3" ] });
        // e1 shared, e2 only מתחילים, e3 only מתקדמים; m2 only מתקדמים.
        Object.assign(state.events.e2, { shuffles: [ "מתחילים" ] });
        Object.assign(state.events.e3, { shuffles: [ "מתקדמים" ] });
        Object.assign(state, {
            modules: { ...state.modules, m2: { id: "m2", title: "מודול 2", syllabusId: "s1", events: [ "e4" ], shuffles: [ "מתקדמים" ] } },
        });
        return state;
    };
    const grid = (expanded: (key: string) => boolean = () => true) =>
    {
        const state = shuffled();
        return buildGridRows([ "s1" ], placement(state, { e1: "a1", e2: "a2", e3: "b1", e4: "b2" }), expanded, expanded);
    };

    it("splits a syllabus into one section per shuffle holding only its modules and events", () => {
        expect(grid().map((r) => [ r.kind, r.title ])).toEqual([
            [ "syllabus", "מתמטיקה" ],
            [ "shuffle", "מתמטיקה (מתחילים)" ],
            [ "module", "מודול" ],
            [ "event", "e1" ],
            [ "event", "e2" ],
            [ "shuffle", "מתמטיקה (מתקדמים)" ],
            [ "module", "מודול" ],
            [ "event", "e1" ],
            [ "event", "e3" ],
            [ "module", "מודול 2" ],
            [ "event", "e4" ],
        ]);
        expect(new Set(grid().map((r) => r.key)).size).toBe(11);
    });

    it("sums each shuffle on its own and shows the busiest one on the syllabus, not both", () => {
        const rows = grid();
        const [ syllabus, beginners ] = rows;
        const advanced = rows.find((r) => r.title === "מתמטיקה (מתקדמים)");
        expect(beginners.weekMinutes).toEqual([ 90, 0, 0 ]);
        expect(advanced?.weekMinutes).toEqual([ 60, 135, 0 ]);
        expect(syllabus.weekMinutes).toEqual([ 90, 135, 0 ]);
        expect(syllabus.requiredMinutes).toBe(195);
    });

    it("collapses a shuffle section into its syllabus and each section on its own", () => {
        expect(grid((key) => key !== "s1").map((r) => r.kind)).toEqual([ "syllabus" ]);
        const rows = grid((key) => key !== "s1::מתחילים");
        expect(rows.slice(0, 3).map((r) => r.title)).toEqual([ "מתמטיקה", "מתמטיקה (מתחילים)", "מתמטיקה (מתקדמים)" ]);
    });
});

describe("buildGridRows course presence", () => {
    // Apollo has a 3h midterm in Mathematics › Algebra; Mivtzar does not attend it.
    const paths = [
        { id: "apollo", courseIds: [ "root", "apollo" ], label: "אפולו" },
        { id: "mivtzar", courseIds: [ "root", "mivtzar" ], label: "מבצר" },
    ];
    const grid = (moduleEvents: Array<string>) =>
    {
        const state = store({
            midterm: { minimumDuration: 180 },
            lesson: { minimumDuration: 60 },
        });
        Object.assign(state.events.midterm, { courseIds: [ "apollo" ] });
        Object.assign(state.modules.m1, { events: moduleEvents });
        Object.assign(state.syllabuses.s1, { courseIds: [ "apollo", "mivtzar" ] });
        return buildGridRows([ "s1" ], placement(state, {}), () => true, () => true, paths);
    };
    const presence = (rows: ReturnType<typeof grid>, id: string) => rows.find((r) => r.id === id)?.coursePresence;

    it("fills only the courses attending an event, defaulting to the syllabus' courses", () => {
        const rows = grid([ "midterm", "lesson" ]);
        expect(presence(rows, "midterm")).toEqual([ "full", "none" ]);
        expect(presence(rows, "lesson")).toEqual([ "full", "full" ]);
    });

    it("marks a course that attends only some of a module or syllabus as partial", () => {
        const rows = grid([ "midterm", "lesson" ]);
        expect(presence(rows, "m1")).toEqual([ "full", "partial" ]);
        expect(presence(rows, "s1")).toEqual([ "full", "partial" ]);
        expect(presence(grid([ "midterm" ]), "m1")).toEqual([ "full", "none" ]);
    });
});

describe("formatHours", () => {
    afterEach(() => setHoursFormat("decimal"));

    it("renders decimal or clock hours by the viewer's choice", () => {
        expect(formatHours(45, 2)).toBe("0.75");
        setHoursFormat("clock");
        expect([ formatHours(45), formatHours(90), formatHours(605), formatHours(-30), formatHours(0) ])
            .toEqual([ "0:45", "1:30", "10:05", "-0:30", "0:00" ]);
    });
});

describe("buildGridRows ignoreBreaks", () => {
    const rowsFor = (ignoreBreaks: boolean) => {
        const state = store({ lesson: { minimumDuration: 60 }, "ארוחת בוקר": { minimumDuration: 35 } });
        const placed = { lesson: "a1", "ארוחת בוקר": "a1" };
        return buildGridRows([ "s1" ], { ...placement(state, placed), ignoreBreaks }, () => true, () => true);
    };

    it("counts break events by default", () => {
        const rows = rowsFor(false);
        expect(rows.map((r) => r.title)).toContain("ארוחת בוקר");
        expect(rows.find((r) => r.kind === "syllabus")?.weekMinutes[ 0 ]).toBe(95);
    });

    it("leaves break events out of the rows and every sum", () => {
        const rows = rowsFor(true);
        expect(rows.map((r) => r.title)).not.toContain("ארוחת בוקר");
        expect(rows.find((r) => r.kind === "syllabus")?.weekMinutes[ 0 ]).toBe(60);
    });
});
