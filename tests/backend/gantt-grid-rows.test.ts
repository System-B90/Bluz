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

function mappings(placed: Record<string, string>) {
    return Object.fromEntries(
        Object.entries(placed).map(([ eventId, dayId ]) => [
            eventId,
            { curriculumId: "c", moduleId: "m1", eventId, dayId, sortOrder: 0 },
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
        mappings: mappings(placed),
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

describe("formatHours", () => {
    afterEach(() => setHoursFormat("decimal"));

    it("renders decimal or clock hours by the viewer's choice", () => {
        expect(formatHours(45, 2)).toBe("0.75");
        setHoursFormat("clock");
        expect([ formatHours(45), formatHours(90), formatHours(605), formatHours(-30), formatHours(0) ])
            .toEqual([ "0:45", "1:30", "10:05", "-0:30", "0:00" ]);
    });
});
