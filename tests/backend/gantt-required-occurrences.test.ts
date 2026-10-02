import { describe, expect, it } from "vitest";

import { NormalizedStore } from "@/api-client/gantt/drizzle-normalize";
import { EventRecurrence } from "@/api-shared/types/gantt/models";
import { calculateStudentModuleMinutes } from "@/components/gantt/curriculum-view/student-load";
import { countEventOccurrences, RecurrenceOccurrenceContext } from "@/components/gantt/utils";

/**
 * Regression: the רצף זמן timeline's required time ignored the recurrence
 * window (no `dateOf` reached the echo) and counted only echoes after the
 * placed day. Required = duration x (pattern hits in the window - skips),
 * the same count the grid tab uses.
 */

const LINEAR_DAYS = [ "a1", "a2", "b1", "b2", "c1", "c2" ];
const DATES: Record<string, string> = {
    a1: "2026-01-04", a2: "2026-01-05",
    b1: "2026-01-11", b2: "2026-01-12",
    c1: "2026-01-18", c2: "2026-01-19",
};

function store(event: Record<string, unknown>) {
    return {
        days: Object.fromEntries(
            LINEAR_DAYS.map((id) => [ id, { id, weekId: `w${id[0]}`, dayIndex: Number(id[1]) - 1 } ]),
        ),
        syllabuses: { s1: { id: "s1", title: "סילבוס", modules: [ "m1" ], courseIds: [] } },
        modules: { m1: { id: "m1", title: "מודול", syllabusId: "s1", events: [ "e1" ] } },
        events: {
            e1: {
                id: "e1", title: "אירוע", minimumDuration: 60,
                recurrence: EventRecurrence.Weekly, recurrenceStartDate: null, recurrenceEndDate: null,
                ...event,
            },
        },
    } as unknown as NormalizedStore;
}

function ctx(
    placedOn: null | string,
    { skipped = [] as Array<string>, onlyDayIds = undefined as ReadonlySet<string> | undefined } = {},
): RecurrenceOccurrenceContext {
    return {
        mappings: placedOn
            ? { m: { curriculumId: "c", moduleId: "m1", eventId: "e1", dayId: placedOn, sortOrder: 0 } }
            : {},
        exceptions: Object.fromEntries(skipped.map((dayId, i) => [ `x${i}`, { eventId: "e1", dayId } ])),
        linearDays: LINEAR_DAYS,
        dateOf: (dayId) => DATES[ dayId ],
        onlyDayIds,
    } as RecurrenceOccurrenceContext;
}

const required = (event: Record<string, unknown>, c: RecurrenceOccurrenceContext) => {
    const state = store(event);
    return countEventOccurrences(state.events.e1, "e1", state, c);
};

describe("timeline required occurrences", () => {
    it("respects the recurrence end date", () => {
        expect(required({ recurrenceEndDate: "2026-01-12" }, ctx("a2"))).toBe(2);
    });

    it("respects the recurrence start date", () => {
        expect(required({ recurrenceStartDate: "2026-01-11" }, ctx("b2"))).toBe(2);
    });

    it("counts the whole window, not just echoes after a late placement", () => {
        expect(required({}, ctx("c2"))).toBe(3);
    });

    it("counts an unplaced recurring event by its pattern", () => {
        expect(required({}, ctx(null))).toBe(3);
        expect(required({ recurrence: EventRecurrence.Daily }, ctx(null))).toBe(6);
    });

    it("subtracts skipped occurrences, including a skipped start day", () => {
        expect(required({}, ctx("a2", { skipped: [ "a2", "c2" ] }))).toBe(1);
    });

    it("keeps a placed-in-scope count inside the window for a single week", () => {
        expect(required({ recurrenceEndDate: "2026-01-12" }, ctx("a2", { onlyDayIds: new Set([ "c1", "c2" ]) }))).toBe(0);
        expect(required({}, ctx("a2", { onlyDayIds: new Set([ "c1", "c2" ]) }))).toBe(1);
    });

    it("drives the module's required minutes on the timeline", () => {
        const state = store({ recurrenceEndDate: "2026-01-12" });
        expect(calculateStudentModuleMinutes("m1", state, [], ctx("a2"))).toBe(120);
    });
});
