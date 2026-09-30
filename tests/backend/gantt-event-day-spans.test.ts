import { describe, expect, it } from "vitest";

import { NormalizedStore } from "@/api-client/gantt/drizzle-normalize";
import { computeEventDaySpans } from "@/components/gantt/curriculum-view/gantt-time-utils";

const LINEAR_DAYS = [ "a1", "a2", "b1", "b2", "c1", "c2" ];

function store(event: { minimumDuration: number; splitAcrossWeeks: boolean }) {
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
        events: { e1: { id: "e1", ...event } },
    } as unknown as NormalizedStore;
}

function mapping(dayId: string, weekSplitMinutes?: Array<number>) {
    return {
        m: {
            curriculumId: "c",
            moduleId: "m1",
            eventId: "e1",
            dayId,
            sortOrder: 0,
            weekSplitMinutes,
        },
    };
}

describe("computeEventDaySpans week split (#768)", () => {
    it("puts each part on the same weekday of consecutive weeks", () => {
        const spans = computeEventDaySpans({
            mappings: mapping("a2", [ 180, 180, 240 ]),
            state: store({ minimumDuration: 600, splitAcrossWeeks: true }),
            linearDays: LINEAR_DAYS,
        });

        expect(spans.e1).toEqual({
            dayIds: [ "a2", "b2", "c2" ],
            minutesPerDay: [ 180, 180, 240 ],
            spillover: false,
            weekSplit: true,
        });
    });

    it("counts each part toward its own week's scheduled minutes", () => {
        const byDay: Record<string, number> = {};
        computeEventDaySpans({
            mappings: mapping("a1", [ 300, 300 ]),
            state: store({ minimumDuration: 600, splitAcrossWeeks: true }),
            linearDays: LINEAR_DAYS,
            load: {
                consume: (dayId, _eventId, minutes) => {
                    byDay[ dayId ] = (byDay[ dayId ] ?? 0) + minutes;
                },
            },
        });

        expect(byDay).toEqual({ a1: 300, b1: 300 });
    });

    it("parks parts past the timeline's end on its last week", () => {
        const spans = computeEventDaySpans({
            mappings: mapping("c1", [ 120, 120, 120 ]),
            state: store({ minimumDuration: 360, splitAcrossWeeks: true }),
            linearDays: LINEAR_DAYS,
        });

        expect(spans.e1.dayIds).toEqual([ "c1" ]);
        expect(spans.e1.minutesPerDay).toEqual([ 360 ]);
    });

    it("regression: an unflagged event ignores a stored split and stays whole on its day", () => {
        const spans = computeEventDaySpans({
            mappings: mapping("a1", [ 300, 300 ]),
            state: store({ minimumDuration: 600, splitAcrossWeeks: false }),
            linearDays: LINEAR_DAYS,
        });

        expect(spans.e1).toEqual({
            dayIds: [ "a1" ],
            minutesPerDay: [ 600 ],
            spillover: false,
        });
    });

    it("never spreads an event past its day's capacity onto the next day", () => {
        const byDay: Record<string, number> = {};
        const spans = computeEventDaySpans({
            mappings: mapping("a1"),
            state: store({ minimumDuration: 1000, splitAcrossWeeks: false }),
            linearDays: LINEAR_DAYS,
            load: {
                consume: (dayId, _eventId, minutes) => {
                    byDay[ dayId ] = (byDay[ dayId ] ?? 0) + minutes;
                },
            },
        });

        expect(spans.e1.dayIds).toEqual([ "a1" ]);
        // Over the 480-minute day: surfaces as overload, not as spillover.
        expect(byDay).toEqual({ a1: 1000 });
    });

    it("regression: an incomplete split runs the event whole", () => {
        const spans = computeEventDaySpans({
            mappings: mapping("a1", [ 60, 60 ]),
            state: store({ minimumDuration: 240, splitAcrossWeeks: true }),
            linearDays: LINEAR_DAYS,
        });

        expect(spans.e1).toEqual({
            dayIds: [ "a1" ],
            minutesPerDay: [ 240 ],
            spillover: false,
        });
    });

    it("skips a week whose part is 0 hours", () => {
        const spans = computeEventDaySpans({
            mappings: mapping("a1", [ 300, 0, 300 ]),
            state: store({ minimumDuration: 600, splitAcrossWeeks: true }),
            linearDays: LINEAR_DAYS,
        });

        expect(spans.e1).toMatchObject({ dayIds: [ "a1", "c1" ], minutesPerDay: [ 300, 300 ] });
    });
});
