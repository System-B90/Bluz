import { describe, expect, it } from "vitest";

import { NormalizedStore } from "@/api-client/gantt/drizzle-normalize";
import { computeEventDaySpans } from "@/components/gantt/curriculum-view/gantt-time-utils";

const LINEAR_DAYS = [ "a1", "a2", "b1", "b2", "c1", "c2" ];

function store(minimumDuration: number) {
    const day = (id: string, weekId: string) => ({ id, weekId, totalWorkingMinutes: 480 });
    return {
        weeks: {
            wa: { id: "wa", days: [ "a1", "a2" ] },
            wb: { id: "wb", days: [ "b1", "b2" ] },
            wc: { id: "wc", days: [ "c1", "c2" ] },
        },
        days: Object.fromEntries(
            LINEAR_DAYS.map((id) => [ id, day(id, `w${id[0]}`) ]),
        ),
        events: { e1: { id: "e1", minimumDuration } },
    } as unknown as NormalizedStore;
}

/** One e1 mapping per `[dayId, allottedMinutes]` pair, keyed in the given order. */
function mappings(...parts: Array<[ string, number ]>) {
    return Object.fromEntries(
        parts.map(([ dayId, allottedMinutes ], i) => [
            `m${i}`,
            { curriculumId: "c", moduleId: "m1", eventId: "e1", dayId, sortOrder: 0, allottedMinutes },
        ]),
    );
}

function collectLoad() {
    const byDay: Record<string, number> = {};
    return {
        byDay,
        load: {
            consume: (dayId: string, _eventId: string, minutes: number) => {
                byDay[ dayId ] = (byDay[ dayId ] ?? 0) + minutes;
            },
        },
    };
}

describe("computeEventDaySpans per-mapping allotted minutes", () => {
    it("runs a single mapping for its allotted minutes, not the event's minimum", () => {
        const spans = computeEventDaySpans({
            mappings: mappings([ "a1", 90 ]),
            state: store(600),
            linearDays: LINEAR_DAYS,
        });

        expect(spans.e1).toEqual({ dayIds: [ "a1" ], minutesPerDay: [ 90 ], spillover: false });
        expect(spans.e1.multiDay).toBeFalsy();
    });

    it("merges several mappings of one event into one multi-day span, ordered by day", () => {
        const spans = computeEventDaySpans({
            mappings: mappings([ "c2", 240 ], [ "a2", 180 ], [ "b2", 180 ]),
            state: store(600),
            linearDays: LINEAR_DAYS,
        });

        expect(spans.e1).toEqual({
            dayIds: [ "a2", "b2", "c2" ],
            minutesPerDay: [ 180, 180, 240 ],
            spillover: false,
            multiDay: true,
        });
    });

    it("counts each mapping's minutes toward its own day", () => {
        const { byDay, load } = collectLoad();
        computeEventDaySpans({
            mappings: mappings([ "a1", 300 ], [ "b1", 200 ]),
            state: store(600),
            linearDays: LINEAR_DAYS,
            load,
        });

        expect(byDay).toEqual({ a1: 300, b1: 200 });
    });

    it("keeps a 0-minute mapping as a 0-minute day", () => {
        const spans = computeEventDaySpans({
            mappings: mappings([ "a1", 300 ], [ "b1", 0 ], [ "c1", 300 ]),
            state: store(600),
            linearDays: LINEAR_DAYS,
        });

        expect(spans.e1).toMatchObject({
            dayIds: [ "a1", "b1", "c1" ],
            minutesPerDay: [ 300, 0, 300 ],
            multiDay: true,
        });
    });

    it("treats a mapping without allotted minutes as 0", () => {
        const spans = computeEventDaySpans({
            mappings: { m: { curriculumId: "c", moduleId: "m1", eventId: "e1", dayId: "a1", sortOrder: 0 } } as never,
            state: store(600),
            linearDays: LINEAR_DAYS,
        });

        expect(spans.e1.minutesPerDay).toEqual([ 0 ]);
    });

    it("never spreads an event past its day's capacity onto the next day", () => {
        const { byDay, load } = collectLoad();
        const spans = computeEventDaySpans({
            mappings: mappings([ "a1", 1000 ]),
            state: store(1000),
            linearDays: LINEAR_DAYS,
            load,
        });

        expect(spans.e1.dayIds).toEqual([ "a1" ]);
        // Over the 480-minute day: surfaces as overload, not as spillover.
        expect(byDay).toEqual({ a1: 1000 });
    });

    it("ignores mappings on days outside the timeline", () => {
        const spans = computeEventDaySpans({
            mappings: mappings([ "a1", 60 ], [ "zz", 60 ]),
            state: store(120),
            linearDays: LINEAR_DAYS,
        });

        expect(spans.e1.dayIds).toEqual([ "a1" ]);
    });
});
