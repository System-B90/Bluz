import { describe, expect, it } from "vitest";

import {
    CutPlanDayInput,
    CutPlanEventInput,
    CutPlanInput,
    CutPlanWeekInput,
    planCut,
} from "@/api-shared/gantt/cut-planner";
import { EventRecurrence, GanttDayIndex } from "@/api-shared/types/gantt/models";

const START_DATE = "2024-01-07"; // Sunday

function buildWeeks(weekCount: number) {
    const days: Record<string, CutPlanDayInput> = {};
    const weeks: Array<CutPlanWeekInput> = [];
    for (let w = 0; w < weekCount; w++) {
        const dayIds: Array<string> = [];
        for (let d = 0; d < 5; d++) {
            const id = `w${w}d${d}`;
            days[id] = { id, dayIndex: d as GanttDayIndex };
            dayIds.push(id);
        }
        weeks.push({ id: `week${w}`, dayIds });
    }
    return { days, weeks };
}

function event(overrides: Partial<CutPlanEventInput> = {}): CutPlanEventInput {
    return {
        id: "e1",
        title: "ע\"ע",
        recurrence: EventRecurrence.None,
        minimumDuration: 600,
        splitAcrossBreaks: false,
        ...overrides,
    };
}

/** One mapping per entry: `[dayId, allottedMinutes]`, sortOrder by position. */
function input(
    ev: CutPlanEventInput,
    mappings: Array<[string, number]>,
    weekCount = 3,
): CutPlanInput {
    const { days, weeks } = buildWeeks(weekCount);
    return {
        startDate: START_DATE,
        weeks,
        days,
        events: [ ev ],
        mappings: mappings.map(([ dayId, allottedMinutes ], sortOrder) => ({
            eventId: ev.id,
            dayId,
            sortOrder,
            allottedMinutes,
        })),
        recurrenceExceptions: [],
        dayStartTime: "08:00",
    };
}

const minutes = (occ: { startTime: Date; endTime: Date }) =>
    (occ.endTime.getTime() - occ.startTime.getTime()) / 60000;

const byDate = <T extends { occurrenceDate: string }>(occs: Array<T>): Array<T> =>
    [ ...occs ].sort((a, b) => a.occurrenceDate.localeCompare(b.occurrenceDate));

describe("planCut one event mapped on several days", () => {
    it("cuts one occurrence per mapping, each its own allotted length", () => {
        const plan = planCut(
            input(event(), [
                [ "w0d1", 180 ],
                [ "w1d1", 180 ],
                [ "w2d1", 240 ],
            ]),
        );
        expect(plan.ok).toBe(true);
        if (!plan.ok) return;

        const occs = byDate(plan.occurrences);
        expect(occs.map((o) => o.occurrenceDate)).toEqual([
            "2024-01-08",
            "2024-01-15",
            "2024-01-22",
        ]);
        expect(occs.map(minutes)).toEqual([ 180, 180, 240 ]);
        expect(occs.every((o) => o.ganttEventId === "e1")).toBe(true);
        expect(occs.every((o) => !o.isRecurrenceEcho)).toBe(true);
    });

    it("skips a mapping that allots 0 minutes", () => {
        const plan = planCut(
            input(event(), [
                [ "w0d1", 300 ],
                [ "w1d1", 0 ],
                [ "w2d1", 300 ],
            ]),
        );
        expect(plan.ok).toBe(true);
        if (!plan.ok) return;

        const occs = byDate(plan.occurrences);
        expect(occs.map((o) => o.occurrenceDate)).toEqual([ "2024-01-08", "2024-01-22" ]);
        expect(occs.map(minutes)).toEqual([ 300, 300 ]);
    });

    it("ignores minimumDuration once mappings allot their own minutes", () => {
        const plan = planCut(
            input(event({ minimumDuration: 30 }), [
                [ "w0d0", 90 ],
                [ "w0d3", 45 ],
            ]),
        );
        expect(plan.ok).toBe(true);
        if (!plan.ok) return;

        expect(byDate(plan.occurrences).map(minutes)).toEqual([ 90, 45 ]);
    });
});
