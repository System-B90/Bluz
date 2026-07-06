import { describe, expect, it } from "vitest";

import {
    CutPlanDayInput,
    CutPlanEventInput,
    CutPlanInput,
    CutPlanWeekInput,
    planCut,
} from "@/api-shared/gantt/cut-planner";
import { EventRecurrence, GanttDayIndex } from "@/api-shared/types/gantt/models";

// Two 7-day weeks anchored on a Sunday, dayIds `w{week}d{dayIndex}`.
const START_DATE = "2024-01-07"; // Sunday

function buildWeeks(weekCount: number): {
    days: Record<string, CutPlanDayInput>;
    weeks: Array<CutPlanWeekInput>;
} {
    const days: Record<string, CutPlanDayInput> = {};
    const weeks: Array<CutPlanWeekInput> = [];

    for (let w = 0; w < weekCount; w++) {
        const dayIds: Array<string> = [];
        for (let d = 0; d < 7; d++) {
            const id = `w${w}d${d}`;
            days[id] = { id, dayIndex: d as GanttDayIndex };
            dayIds.push(id);
        }
        weeks.push({ id: `week${w}`, dayIds });
    }

    return { days, weeks };
}

function makeEvent(overrides: Partial<CutPlanEventInput> & { id: string }): CutPlanEventInput {
    return {
        title: overrides.id,
        recurrence: EventRecurrence.None,
        minimumDuration: 60,
        allocatedDuration: 60,
        ...overrides,
    };
}

function baseInput(overrides: Partial<CutPlanInput> = {}): CutPlanInput {
    const { days, weeks } = buildWeeks(2);
    return {
        startDate: START_DATE,
        weeks,
        days,
        events: [],
        mappings: [],
        recurrenceExceptions: [],
        dayStartTime: "08:00",
        ...overrides,
    };
}

describe("planCut", () => {
    it("plans a single mapped event on the correct date and start time", () => {
        const event = makeEvent({ id: "e1", minimumDuration: 90, allocatedDuration: 90 });
        const input = baseInput({
            events: [ event ],
            mappings: [ { eventId: "e1", dayId: "w0d2", sortOrder: 0 } ],
        });

        const plan = planCut(input);
        expect(plan.ok).toBe(true);
        if (!plan.ok) return;

        expect(plan.occurrences).toHaveLength(1);
        const occ = plan.occurrences[0];
        expect(occ.ganttEventId).toBe("e1");
        expect(occ.occurrenceDate).toBe("2024-01-09"); // Sunday + 2 days = Tuesday
        expect(occ.isRecurrenceEcho).toBe(false);
        expect(occ.startTime.toISOString()).toBe(
            new Date("2024-01-09T08:00:00").toISOString(),
        );
        expect(occ.endTime.getTime() - occ.startTime.getTime()).toBe(90 * 60 * 1000);
    });

    it("stacks two events on the same day sequentially by sortOrder", () => {
        const e1 = makeEvent({ id: "e1", minimumDuration: 60, allocatedDuration: 60 });
        const e2 = makeEvent({ id: "e2", minimumDuration: 30, allocatedDuration: 30 });
        const input = baseInput({
            events: [ e1, e2 ],
            mappings: [
                { eventId: "e2", dayId: "w0d0", sortOrder: 1 },
                { eventId: "e1", dayId: "w0d0", sortOrder: 0 },
            ],
        });

        const plan = planCut(input);
        expect(plan.ok).toBe(true);
        if (!plan.ok) return;

        expect(plan.occurrences).toHaveLength(2);
        const [ first, second ] = plan.occurrences;
        expect(first.ganttEventId).toBe("e1");
        expect(second.ganttEventId).toBe("e2");
        expect(first.startTime.toISOString()).toBe(
            new Date("2024-01-07T08:00:00").toISOString(),
        );
        expect(second.startTime.getTime()).toBe(first.endTime.getTime());
        expect(second.endTime.getTime() - second.startTime.getTime()).toBe(30 * 60 * 1000);
    });

    it("falls back to minimumDuration when allocatedDuration is falsy", () => {
        const event = makeEvent({ id: "e1", minimumDuration: 45, allocatedDuration: 0 });
        const input = baseInput({
            events: [ event ],
            mappings: [ { eventId: "e1", dayId: "w0d0", sortOrder: 0 } ],
        });

        const plan = planCut(input);
        expect(plan.ok).toBe(true);
        if (!plan.ok) return;

        const occ = plan.occurrences[0];
        expect(occ.endTime.getTime() - occ.startTime.getTime()).toBe(45 * 60 * 1000);
    });

    it("expands a daily recurrence over 2 weeks, skipping an exception day", () => {
        const event = makeEvent({
            id: "e1",
            recurrence: EventRecurrence.Daily,
            minimumDuration: 60,
            allocatedDuration: 60,
        });
        const input = baseInput({
            events: [ event ],
            mappings: [ { eventId: "e1", dayId: "w0d0", sortOrder: 0 } ],
            recurrenceExceptions: [ { eventId: "e1", dayId: "w0d2" } ],
        });

        const plan = planCut(input);
        expect(plan.ok).toBe(true);
        if (!plan.ok) return;

        // 14 days total, minus the start day already counted once, minus 1 exception.
        expect(plan.occurrences).toHaveLength(13);
        const startOcc = plan.occurrences.find((o) => o.occurrenceDate === "2024-01-07");
        expect(startOcc?.isRecurrenceEcho).toBe(false);
        expect(plan.occurrences.some((o) => o.occurrenceDate === "2024-01-09")).toBe(false);
        const echo = plan.occurrences.find((o) => o.occurrenceDate === "2024-01-08");
        expect(echo?.isRecurrenceEcho).toBe(true);
    });

    it("aligns weekly recurrence to the same weekday in later weeks", () => {
        const event = makeEvent({
            id: "e1",
            recurrence: EventRecurrence.Weekly,
            minimumDuration: 60,
            allocatedDuration: 60,
        });
        const input = baseInput({
            events: [ event ],
            // w0d2 = Tuesday, week 1.
            mappings: [ { eventId: "e1", dayId: "w0d2", sortOrder: 0 } ],
        });

        const plan = planCut(input);
        expect(plan.ok).toBe(true);
        if (!plan.ok) return;

        expect(plan.occurrences).toHaveLength(2);
        const dates = plan.occurrences.map((o) => o.occurrenceDate).sort();
        expect(dates).toEqual([ "2024-01-09", "2024-01-16" ]); // both Tuesdays
    });

    it("returns a missing-start-date error", () => {
        const input = baseInput({ startDate: null });
        const plan = planCut(input);
        expect(plan.ok).toBe(false);
        if (plan.ok) return;
        expect(plan.errors).toEqual([ { type: "missing-start-date" } ]);
    });

    it("returns an unmapped-event error for an event with no day mapping", () => {
        const event = makeEvent({ id: "e1", title: "Unmapped" });
        const input = baseInput({ events: [ event ], mappings: [] });

        const plan = planCut(input);
        expect(plan.ok).toBe(false);
        if (plan.ok) return;
        expect(plan.errors).toEqual([
            { type: "unmapped-event", eventId: "e1", title: "Unmapped" },
        ]);
    });

    it("returns an unsatisfied-recurrence error when a recurring event doesn't start in week 1", () => {
        const event = makeEvent({
            id: "e1",
            title: "Late start",
            recurrence: EventRecurrence.Weekly,
        });
        const input = baseInput({
            events: [ event ],
            mappings: [ { eventId: "e1", dayId: "w1d2", sortOrder: 0 } ],
        });

        const plan = planCut(input);
        expect(plan.ok).toBe(false);
        if (plan.ok) return;
        expect(plan.errors).toEqual([
            { type: "unsatisfied-recurrence", eventId: "e1", title: "Late start" },
        ]);
    });

    it("collects all validation errors across multiple events", () => {
        const unmapped = makeEvent({ id: "e1", title: "Unmapped" });
        const lateRecurring = makeEvent({
            id: "e2",
            title: "Late",
            recurrence: EventRecurrence.Daily,
        });
        const input = baseInput({
            startDate: null,
            events: [ unmapped, lateRecurring ],
            mappings: [ { eventId: "e2", dayId: "w1d0", sortOrder: 0 } ],
        });

        const plan = planCut(input);
        expect(plan.ok).toBe(false);
        if (plan.ok) return;
        expect(plan.errors).toEqual([
            { type: "missing-start-date" },
            { type: "unmapped-event", eventId: "e1", title: "Unmapped" },
            { type: "unsatisfied-recurrence", eventId: "e2", title: "Late" },
        ]);
    });

    it("orders echo occurrences deterministically by event title", () => {
        const bEvent = makeEvent({
            id: "b",
            title: "Bravo",
            recurrence: EventRecurrence.Daily,
        });
        const aEvent = makeEvent({
            id: "a",
            title: "Alpha",
            recurrence: EventRecurrence.Daily,
        });
        const input = baseInput({
            weeks: buildWeeks(1).weeks,
            days: buildWeeks(1).days,
            events: [ bEvent, aEvent ],
            mappings: [
                { eventId: "b", dayId: "w0d0", sortOrder: 0 },
                { eventId: "a", dayId: "w0d0", sortOrder: 1 },
            ],
        });

        const plan = planCut(input);
        expect(plan.ok).toBe(true);
        if (!plan.ok) return;

        const echoDay = plan.occurrences.filter((o) => o.occurrenceDate === "2024-01-08");
        expect(echoDay.map((o) => o.ganttEventId)).toEqual([ "a", "b" ]);
    });
});
