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
        allocatedDuration: 600,
        splitAcrossBreaks: false,
        splitAcrossWeeks: true,
        ...overrides,
    };
}

function input(
    ev: CutPlanEventInput,
    weekSplitMinutes: Array<number> | undefined,
    weekCount = 3,
): CutPlanInput {
    const { days, weeks } = buildWeeks(weekCount);
    return {
        startDate: START_DATE,
        weeks,
        days,
        events: [ ev ],
        mappings: [ { eventId: "e1", dayId: "w0d1", sortOrder: 0, weekSplitMinutes } ],
        recurrenceExceptions: [],
        dayStartTime: "08:00",
    };
}

const minutes = (occ: { startTime: Date; endTime: Date }) =>
    (occ.endTime.getTime() - occ.startTime.getTime()) / 60000;

describe("planCut week split (#768)", () => {
    it("cuts one occurrence per part, same weekday in consecutive weeks", () => {
        const plan = planCut(input(event(), [ 180, 180, 240 ]));
        expect(plan.ok).toBe(true);
        if (!plan.ok) return;

        const occs = [ ...plan.occurrences ].sort((a, b) =>
            a.occurrenceDate.localeCompare(b.occurrenceDate),
        );
        expect(occs.map((o) => o.occurrenceDate)).toEqual([
            "2024-01-08",
            "2024-01-15",
            "2024-01-22",
        ]);
        expect(occs.map(minutes)).toEqual([ 180, 180, 240 ]);
        expect(occs.every((o) => o.ganttEventId === "e1")).toBe(true);
    });

    it("folds parts past the timeline's end into its last week", () => {
        const plan = planCut(input(event({ minimumDuration: 360, allocatedDuration: 360 }), [ 120, 120, 120 ], 2));
        expect(plan.ok).toBe(true);
        if (!plan.ok) return;

        expect(plan.occurrences.map(minutes).sort()).toEqual([ 120, 240 ]);
    });

    it("regression: an unflagged event cuts whole despite a stored split", () => {
        const plan = planCut(input(event({ splitAcrossWeeks: false }), [ 300, 300 ]));
        expect(plan.ok).toBe(true);
        if (!plan.ok) return;

        expect(plan.occurrences).toHaveLength(1);
        expect(minutes(plan.occurrences[ 0 ])).toBe(600);
    });

    it("regression: a split not matching the duration cuts whole", () => {
        const plan = planCut(input(event(), [ 60, 60 ]));
        expect(plan.ok).toBe(true);
        if (!plan.ok) return;

        expect(plan.occurrences).toHaveLength(1);
    });
});
