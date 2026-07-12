import { describe, expect, it } from "vitest";

import {
    CutPlanDayInput,
    CutPlanEventInput,
    CutPlanInput,
    CutPlanWeekInput,
    planCut,
    PlannedOccurrence,
} from "@/api-shared/gantt/cut-planner";
import { EventRecurrence, GanttDayIndex } from "@/api-shared/types/gantt/models";

/**
 * Edge-case coverage for the pure cut planner, complementing
 * `gantt-cut-planner.test.ts`: multi-week date extrapolation, partial weeks,
 * multi-mapping events, echo/mapped interleaving, custom day-start times,
 * exception handling and input robustness.
 */

const START_DATE = "2024-01-07"; // Sunday

function buildWeeks(
    weekCount: number,
    daysPerWeek = 7,
): { days: Record<string, CutPlanDayInput>; weeks: Array<CutPlanWeekInput> } {
    const days: Record<string, CutPlanDayInput> = {};
    const weeks: Array<CutPlanWeekInput> = [];
    for (let w = 0; w < weekCount; w++) {
        const dayIds: Array<string> = [];
        for (let d = 0; d < daysPerWeek; d++) {
            const id = `w${w}d${d}`;
            days[id] = { id, dayIndex: d as GanttDayIndex };
            dayIds.push(id);
        }
        weeks.push({ id: `week${w}`, dayIds });
    }
    return { days, weeks };
}

function makeEvent(
    overrides: Partial<CutPlanEventInput> & { id: string },
): CutPlanEventInput {
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

function occurrencesOf(
    plan: ReturnType<typeof planCut>,
): Array<PlannedOccurrence> {
    expect(plan.ok).toBe(true);
    return plan.ok ? plan.occurrences : [];
}

const hhmm = (d: Date) =>
    `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

describe("planCut — date anchoring", () => {
    it("extrapolates dates across weeks: week N, dayIndex D → start + 7N + D days", () => {
        const { days, weeks } = buildWeeks(4);
        const plan = planCut(
            baseInput({
                days,
                weeks,
                events: [makeEvent({ id: "e1" })],
                mappings: [{ eventId: "e1", dayId: "w3d4", sortOrder: 0 }],
            }),
        );
        const [occ] = occurrencesOf(plan);
        // 2024-01-07 + 3*7 + 4 = 2024-02-01 (Thursday)
        expect(occ.occurrenceDate).toBe("2024-02-01");
    });

    it("handles a curriculum start crossing a month boundary", () => {
        const plan = planCut(
            baseInput({
                startDate: "2024-01-28", // Sunday
                events: [makeEvent({ id: "e1" })],
                mappings: [{ eventId: "e1", dayId: "w1d2", sortOrder: 0 }],
            }),
        );
        const [occ] = occurrencesOf(plan);
        // 2024-01-28 + 7 + 2 = 2024-02-06
        expect(occ.occurrenceDate).toBe("2024-02-06");
    });

    it("respects sparse weeks (e.g. 5-day work weeks) via dayIndex, not position", () => {
        // Week with only Sunday..Thursday (dayIndex 0..4).
        const { days, weeks } = buildWeeks(2, 5);
        const plan = planCut(
            baseInput({
                days,
                weeks,
                events: [makeEvent({ id: "e1" })],
                mappings: [{ eventId: "e1", dayId: "w1d4", sortOrder: 0 }],
            }),
        );
        const [occ] = occurrencesOf(plan);
        // Week ordinal 1, dayIndex 4 → +11 days.
        expect(occ.occurrenceDate).toBe("2024-01-18");
    });
});

describe("planCut — stacking & durations", () => {
    it("honors a custom day-start time", () => {
        const plan = planCut(
            baseInput({
                dayStartTime: "10:45",
                events: [makeEvent({ id: "e1", allocatedDuration: 30 })],
                mappings: [{ eventId: "e1", dayId: "w0d0", sortOrder: 0 }],
            }),
        );
        const [occ] = occurrencesOf(plan);
        expect(hhmm(occ.startTime)).toBe("10:45");
        expect(hhmm(occ.endTime)).toBe("11:15");
    });

    it("stacks many events back-to-back with mixed durations, no gaps or overlaps", () => {
        const durations = [45, 90, 30, 120];
        const events = durations.map((minutes, i) =>
            makeEvent({ id: `e${i}`, allocatedDuration: minutes }),
        );
        const plan = planCut(
            baseInput({
                events,
                mappings: events.map((e, i) => ({
                    eventId: e.id,
                    dayId: "w0d0",
                    sortOrder: i,
                })),
            }),
        );
        const occurrences = occurrencesOf(plan);
        expect(occurrences).toHaveLength(4);
        for (let i = 1; i < occurrences.length; i++) {
            expect(occurrences[i].startTime.getTime()).toBe(
                occurrences[i - 1].endTime.getTime(),
            );
        }
        const totalMinutes =
            (occurrences[3].endTime.getTime() -
                occurrences[0].startTime.getTime()) /
            60_000;
        expect(totalMinutes).toBe(45 + 90 + 30 + 120);
    });

    it("stacks days independently — a full day never spills into the next", () => {
        const plan = planCut(
            baseInput({
                events: [
                    makeEvent({ id: "a", allocatedDuration: 600 }),
                    makeEvent({ id: "b", allocatedDuration: 60 }),
                ],
                mappings: [
                    { eventId: "a", dayId: "w0d0", sortOrder: 0 },
                    { eventId: "b", dayId: "w0d1", sortOrder: 0 },
                ],
            }),
        );
        const byId = Object.fromEntries(
            occurrencesOf(plan).map((o) => [o.ganttEventId, o]),
        );
        expect(hhmm(byId.b.startTime)).toBe("08:00");
        expect(byId.b.occurrenceDate).toBe("2024-01-08");
    });

    it("uses minimumDuration when allocatedDuration is 0 and allocated when set", () => {
        const plan = planCut(
            baseInput({
                events: [
                    makeEvent({ id: "fallback", allocatedDuration: 0, minimumDuration: 25 }),
                    makeEvent({ id: "allocated", allocatedDuration: 200, minimumDuration: 25 }),
                ],
                mappings: [
                    { eventId: "fallback", dayId: "w0d0", sortOrder: 0 },
                    { eventId: "allocated", dayId: "w0d1", sortOrder: 0 },
                ],
            }),
        );
        const byId = Object.fromEntries(
            occurrencesOf(plan).map((o) => [
                o.ganttEventId,
                (o.endTime.getTime() - o.startTime.getTime()) / 60_000,
            ]),
        );
        expect(byId.fallback).toBe(25);
        expect(byId.allocated).toBe(200);
    });
});

describe("planCut — multiple mappings per event", () => {
    it("produces one occurrence per mapped day for a non-recurring event", () => {
        const plan = planCut(
            baseInput({
                events: [makeEvent({ id: "e1" })],
                mappings: [
                    { eventId: "e1", dayId: "w0d0", sortOrder: 0 },
                    { eventId: "e1", dayId: "w0d3", sortOrder: 1 },
                    { eventId: "e1", dayId: "w1d1", sortOrder: 2 },
                ],
            }),
        );
        const occurrences = occurrencesOf(plan);
        expect(occurrences).toHaveLength(3);
        expect(occurrences.map((o) => o.occurrenceDate).sort()).toEqual([
            "2024-01-07",
            "2024-01-10",
            "2024-01-15",
        ]);
        expect(occurrences.every((o) => !o.isRecurrenceEcho)).toBe(true);
    });
});

describe("planCut — recurrence", () => {
    it("daily recurrence echoes over every remaining day of the timeline", () => {
        const plan = planCut(
            baseInput({
                events: [
                    makeEvent({ id: "daily", recurrence: EventRecurrence.Daily }),
                ],
                mappings: [{ eventId: "daily", dayId: "w0d0", sortOrder: 0 }],
            }),
        );
        const occurrences = occurrencesOf(plan);
        // 14 timeline days: 1 mapped + 13 echoes.
        expect(occurrences).toHaveLength(14);
        expect(occurrences.filter((o) => o.isRecurrenceEcho)).toHaveLength(13);
        const dates = new Set(occurrences.map((o) => o.occurrenceDate));
        expect(dates.size).toBe(14);
    });

    it("weekly recurrence echoes only on the matching weekday of later weeks", () => {
        const { days, weeks } = buildWeeks(3);
        const plan = planCut(
            baseInput({
                days,
                weeks,
                events: [
                    makeEvent({ id: "weekly", recurrence: EventRecurrence.Weekly }),
                ],
                mappings: [{ eventId: "weekly", dayId: "w0d2", sortOrder: 0 }],
            }),
        );
        const occurrences = occurrencesOf(plan);
        expect(occurrences.map((o) => o.occurrenceDate).sort()).toEqual([
            "2024-01-09",
            "2024-01-16",
            "2024-01-23",
        ]);
        expect(occurrences.filter((o) => o.isRecurrenceEcho)).toHaveLength(2);
    });

    it("skips every excepted day of a daily recurrence", () => {
        const plan = planCut(
            baseInput({
                events: [
                    makeEvent({ id: "daily", recurrence: EventRecurrence.Daily }),
                ],
                mappings: [{ eventId: "daily", dayId: "w0d0", sortOrder: 0 }],
                recurrenceExceptions: [
                    { eventId: "daily", dayId: "w0d3" },
                    { eventId: "daily", dayId: "w1d5" },
                ],
            }),
        );
        const dates = occurrencesOf(plan).map((o) => o.occurrenceDate);
        expect(dates).toHaveLength(12);
        expect(dates).not.toContain("2024-01-10"); // w0d3
        expect(dates).not.toContain("2024-01-19"); // w1d5
    });

    it("exceptions of one event never affect another event", () => {
        const plan = planCut(
            baseInput({
                events: [
                    makeEvent({ id: "a", recurrence: EventRecurrence.Daily }),
                    makeEvent({ id: "b", recurrence: EventRecurrence.Daily }),
                ],
                mappings: [
                    { eventId: "a", dayId: "w0d0", sortOrder: 0 },
                    { eventId: "b", dayId: "w0d0", sortOrder: 1 },
                ],
                recurrenceExceptions: [{ eventId: "a", dayId: "w0d1" }],
            }),
        );
        const occurrences = occurrencesOf(plan);
        const onExceptedDay = occurrences.filter(
            (o) => o.occurrenceDate === "2024-01-08",
        );
        expect(onExceptedDay.map((o) => o.ganttEventId)).toEqual(["b"]);
    });

    it("stacks echoes after the echoed day's own mapped events", () => {
        const plan = planCut(
            baseInput({
                events: [
                    makeEvent({ id: "daily", recurrence: EventRecurrence.Daily, allocatedDuration: 30 }),
                    makeEvent({ id: "own", allocatedDuration: 45 }),
                ],
                mappings: [
                    { eventId: "daily", dayId: "w0d0", sortOrder: 0 },
                    { eventId: "own", dayId: "w0d1", sortOrder: 0 },
                ],
            }),
        );
        const day2 = occurrencesOf(plan).filter(
            (o) => o.occurrenceDate === "2024-01-08",
        );
        expect(day2).toHaveLength(2);
        const own = day2.find((o) => o.ganttEventId === "own");
        const echo = day2.find((o) => o.ganttEventId === "daily");
        expect(own).toBeDefined();
        expect(echo).toBeDefined();
        expect(echo!.isRecurrenceEcho).toBe(true);
        // Own event opens the day; the echo starts exactly when it ends.
        expect(hhmm(own!.startTime)).toBe("08:00");
        expect(echo!.startTime.getTime()).toBe(own!.endTime.getTime());
    });

    it("is deterministic: identical input yields identical output ordering", () => {
        const input = baseInput({
            events: [
                makeEvent({ id: "b-daily", title: "בבב", recurrence: EventRecurrence.Daily }),
                makeEvent({ id: "a-daily", title: "אאא", recurrence: EventRecurrence.Daily }),
                makeEvent({ id: "own" }),
            ],
            mappings: [
                { eventId: "b-daily", dayId: "w0d0", sortOrder: 0 },
                { eventId: "a-daily", dayId: "w0d0", sortOrder: 1 },
                { eventId: "own", dayId: "w0d2", sortOrder: 0 },
            ],
        });
        const first = occurrencesOf(planCut(input));
        const second = occurrencesOf(planCut(input));
        expect(second).toEqual(first);
        // Echoes on any given day are title-ordered (א before ב).
        const echoDay = first.filter(
            (o) => o.occurrenceDate === "2024-01-08" && o.isRecurrenceEcho,
        );
        expect(echoDay.map((o) => o.ganttEventId)).toEqual(["a-daily", "b-daily"]);
    });
});

describe("planCut — validation & robustness", () => {
    it("accepts an empty curriculum (no events) as a valid empty plan", () => {
        const plan = planCut(baseInput());
        expect(occurrencesOf(plan)).toEqual([]);
    });

    it("treats a mapping to a day outside the timeline as unmapped", () => {
        const plan = planCut(
            baseInput({
                events: [makeEvent({ id: "e1", title: "מנותק" })],
                mappings: [{ eventId: "e1", dayId: "ghost-day", sortOrder: 0 }],
            }),
        );
        expect(plan.ok).toBe(false);
        if (plan.ok) return;
        expect(plan.errors).toEqual([
            { type: "unmapped-event", eventId: "e1", title: "מנותק" },
        ]);
    });

    it("ignores mappings that reference unknown events instead of crashing", () => {
        const plan = planCut(
            baseInput({
                events: [makeEvent({ id: "e1" })],
                mappings: [
                    { eventId: "e1", dayId: "w0d0", sortOrder: 0 },
                    { eventId: "ghost-event", dayId: "w0d1", sortOrder: 0 },
                ],
            }),
        );
        const occurrences = occurrencesOf(plan);
        expect(occurrences).toHaveLength(1);
        expect(occurrences[0].ganttEventId).toBe("e1");
    });

    it("reports missing-start-date together with per-event errors", () => {
        const plan = planCut(
            baseInput({
                startDate: null,
                events: [makeEvent({ id: "e1", title: "גם לא ממופה" })],
            }),
        );
        expect(plan.ok).toBe(false);
        if (plan.ok) return;
        expect(plan.errors).toContainEqual({ type: "missing-start-date" });
        expect(plan.errors).toContainEqual({
            type: "unmapped-event",
            eventId: "e1",
            title: "גם לא ממופה",
        });
    });

    it("flags a recurring event starting in week 2 as unsatisfied", () => {
        const plan = planCut(
            baseInput({
                events: [
                    makeEvent({ id: "late", title: "מאחר", recurrence: EventRecurrence.Weekly }),
                ],
                mappings: [{ eventId: "late", dayId: "w1d0", sortOrder: 0 }],
            }),
        );
        expect(plan.ok).toBe(false);
        if (plan.ok) return;
        expect(plan.errors).toEqual([
            { type: "unsatisfied-recurrence", eventId: "late", title: "מאחר" },
        ]);
    });
});
