import { describe, expect, it } from "vitest";

import { EventRecurrence } from "@/api-shared/types/gantt/models";
import { getModuleSpanDayIds } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/module-span";

/**
 * A רצף זמן module block spans first → last allocated event, and never
 * covers a timeframe holding none of its events.
 */

// Two 5-day weeks: w1 = d0..d4, w2 = d5..d9. dayIndex = weekday (0..4).
const linearDays = Array.from({ length: 10 }, (_, i) => `d${ i }`);
const days = Object.fromEntries(
    linearDays.map((id, i) => [ id, { id, dayIndex: i % 5 } ]),
) as never;

function span(overrides: Partial<Parameters<typeof getModuleSpanDayIds>[0]> = {}) {
    return getModuleSpanDayIds({
        eventIds: [],
        moduleDayIds: [],
        eventMappings: {},
        eventSpans: {},
        exceptions: {},
        linearDays,
        events: {} as never,
        days,
        ...overrides,
    });
}

const bounds = (ids: Set<string>) => {
    const idx = [ ...ids ].map((d) => linearDays.indexOf(d));
    return { min: Math.min(...idx), max: Math.max(...idx) };
};

describe("getModuleSpanDayIds", () => {
    it("spans from the first allocated event to the last", () => {
        const ids = span({
            eventIds: [ "e1", "e2", "e3" ],
            eventMappings: { e1: "d6", e2: "d2", e3: "d4" },
        });

        expect(bounds(ids)).toEqual({ min: 2, max: 6 });
    });

    it("ignores unallocated events", () => {
        const ids = span({
            eventIds: [ "e1", "e2" ],
            eventMappings: { e1: "d3" },
        });

        expect([ ...ids ]).toEqual([ "d3" ]);
    });

    it("regression: stale module-level mappings never stretch a module with events", () => {
        const ids = span({
            eventIds: [ "e1" ],
            moduleDayIds: [ "d0", "d9" ],
            eventMappings: { e1: "d4" },
        });

        expect([ ...ids ]).toEqual([ "d4" ]);
    });

    it("has no span when none of its events are allocated", () => {
        const ids = span({
            eventIds: [ "e1" ],
            moduleDayIds: [ "d1" ],
        });

        expect(ids.size).toBe(0);
    });

    it("places an event-less module by its own mappings", () => {
        expect([ ...span({ moduleDayIds: [ "d1", "d2" ] }) ]).toEqual([ "d1", "d2" ]);
    });

    it("extends to the last day of a multi-day event", () => {
        const ids = span({
            eventIds: [ "e1" ],
            eventMappings: { e1: "d3" },
            eventSpans: {
                e1: { dayIds: [ "d3", "d8" ], minutesPerDay: [ 300, 300 ], spillover: false, multiDay: true },
            },
        });

        expect([ ...ids ]).toEqual([ "d3", "d8" ]);
    });

    it("extends to the last surviving recurrence occurrence", () => {
        const ids = span({
            eventIds: [ "e1" ],
            eventMappings: { e1: "d1" },
            events: { e1: { recurrence: EventRecurrence.Weekly } } as never,
        });

        expect(bounds(ids)).toEqual({ min: 1, max: 6 });
    });

    it("stops before an excluded trailing recurrence occurrence", () => {
        const ids = span({
            eventIds: [ "e1" ],
            eventMappings: { e1: "d1" },
            events: { e1: { recurrence: EventRecurrence.Weekly } } as never,
            exceptions: { x: { eventId: "e1", dayId: "d6" } },
        });

        expect(bounds(ids)).toEqual({ min: 1, max: 1 });
    });

    it("every covered day holds one of the module's events", () => {
        const ids = span({
            eventIds: [ "e1", "e2" ],
            moduleDayIds: [ "d0", "d8" ],
            eventMappings: { e1: "d2", e2: "d5" },
        });

        expect([ ...ids ].sort()).toEqual([ "d2", "d5" ]);
    });
});
