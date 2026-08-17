import { describe, expect, it } from "vitest";

import { venueTime } from "./helpers/venue-time";
import {
    CutPlanDayInput,
    CutPlanEventInput,
    CutPlanInput,
    CutPlanWeekInput,
    planCut,
} from "@/api-shared/gantt/cut-planner";
import { MEAL_EVENT_TITLES } from "@/api-shared/types/settings/meal";
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
        splitAcrossBreaks: false,
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
            venueTime("2024-01-09T08:00"),
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
            venueTime("2024-01-07T08:00"),
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

    it("bumps a non-split event past a meal window it would overlap", () => {
        const lunch = makeEvent({
            id: "lunch",
            title: MEAL_EVENT_TITLES.lunchTime,
            minimumDuration: 30,
            allocatedDuration: 30,
        });
        const exercise = makeEvent({
            id: "ex",
            minimumDuration: 90,
            allocatedDuration: 90,
            splitAcrossBreaks: false,
        });
        const input = baseInput({
            events: [ lunch, exercise ],
            mappings: [
                { eventId: "lunch", dayId: "w0d0", sortOrder: 0 },
                { eventId: "ex", dayId: "w0d0", sortOrder: 1 },
            ],
            dayStartTime: "12:15", // overlaps the 13:00 lunch window
            lunchTime: "13:00",
        });

        const plan = planCut(input);
        expect(plan.ok).toBe(true);
        if (!plan.ok) return;

        const occ = plan.occurrences.find((o) => o.ganttEventId === "ex");
        expect(occ).toBeDefined();
        // Bumped to start right after the 30-minute lunch window (13:30),
        // duration unaffected.
        expect(occ!.startTime.toISOString()).toBe(
            venueTime("2024-01-07T13:30"),
        );
        expect(occ!.endTime.getTime() - occ!.startTime.getTime()).toBe(90 * 60 * 1000);
    });

    // #474: an event that cannot fit after the break overlaps it rather than
    // being pushed past midnight, which put it on the wrong day entirely.
    it("overlaps a break rather than bumping an event past midnight", () => {
        const dinner = makeEvent({
            id: "dinner",
            title: MEAL_EVENT_TITLES.dinnerTime,
            minimumDuration: 30,
            allocatedDuration: 30,
        });
        const marathon = makeEvent({
            id: "long",
            minimumDuration: 480,
            allocatedDuration: 480,
            splitAcrossBreaks: false,
        });
        const input = baseInput({
            events: [ dinner, marathon ],
            mappings: [
                { eventId: "dinner", dayId: "w0d0", sortOrder: 0 },
                { eventId: "long", dayId: "w0d0", sortOrder: 1 },
            ],
            // 8 hours from 18:00 runs to 02:00; bumping past the 19:00 dinner
            // would end at 03:30 the next day.
            dayStartTime: "18:00",
            dinnerTime: "19:00",
        });

        const plan = planCut(input);
        expect(plan.ok).toBe(true);
        if (!plan.ok) return;

        const occ = plan.occurrences.find((o) => o.ganttEventId === "long");
        expect(occ!.startTime.toISOString()).toBe(
            venueTime("2024-01-07T18:00"),
        );
        expect(occ!.endTime.getTime() - occ!.startTime.getTime()).toBe(
            480 * 60 * 1000,
        );
    });

    it("still bumps past the break when the event fits before midnight", () => {
        const lunch = makeEvent({
            id: "lunch",
            title: MEAL_EVENT_TITLES.lunchTime,
            minimumDuration: 30,
            allocatedDuration: 30,
        });
        const long = makeEvent({
            id: "long",
            minimumDuration: 300,
            allocatedDuration: 300,
            splitAcrossBreaks: false,
        });
        const input = baseInput({
            events: [ lunch, long ],
            mappings: [
                { eventId: "lunch", dayId: "w0d0", sortOrder: 0 },
                { eventId: "long", dayId: "w0d0", sortOrder: 1 },
            ],
            dayStartTime: "12:15",
            lunchTime: "13:00",
        });

        const plan = planCut(input);
        expect(plan.ok).toBe(true);
        if (!plan.ok) return;

        const occ = plan.occurrences.find((o) => o.ganttEventId === "long");
        // 13:30 + 5h = 18:30, comfortably inside the day.
        expect(occ!.startTime.toISOString()).toBe(
            venueTime("2024-01-07T13:30"),
        );
    });

    it("runs a split event through a meal window instead of bumping it past", () => {
        const lunch = makeEvent({
            id: "lunch",
            title: MEAL_EVENT_TITLES.lunchTime,
            minimumDuration: 30,
            allocatedDuration: 30,
        });
        const exercise = makeEvent({
            id: "ex",
            minimumDuration: 90,
            allocatedDuration: 90,
            splitAcrossBreaks: true,
        });
        const input = baseInput({
            events: [ lunch, exercise ],
            mappings: [
                { eventId: "lunch", dayId: "w0d0", sortOrder: 0 },
                { eventId: "ex", dayId: "w0d0", sortOrder: 1 },
            ],
            dayStartTime: "12:15", // overlaps the 13:00 lunch window
            lunchTime: "13:00",
        });

        const plan = planCut(input);
        expect(plan.ok).toBe(true);
        if (!plan.ok) return;

        const occ = plan.occurrences.find((o) => o.ganttEventId === "ex");
        expect(occ).toBeDefined();
        // Start untouched (still 12:15) and the stored span stays the net 90
        // minutes — the two drawn pieces (12:15-13:00, 13:30-14:15) are a
        // rendering concern, not a duration change.
        expect(occ!.startTime.toISOString()).toBe(
            venueTime("2024-01-07T12:15"),
        );
        expect(occ!.endTime.toISOString()).toBe(
            venueTime("2024-01-07T13:45"),
        );
    });

    it("stacks the next event after the last drawn piece of a split event", () => {
        const lunch = makeEvent({
            id: "lunch",
            title: MEAL_EVENT_TITLES.lunchTime,
            minimumDuration: 30,
            allocatedDuration: 30,
        });
        const exercise = makeEvent({
            id: "ex",
            minimumDuration: 90,
            allocatedDuration: 90,
            splitAcrossBreaks: true,
        });
        const next = makeEvent({
            id: "next",
            minimumDuration: 60,
            allocatedDuration: 60,
        });
        const input = baseInput({
            events: [ lunch, exercise, next ],
            mappings: [
                { eventId: "lunch", dayId: "w0d0", sortOrder: 0 },
                { eventId: "ex", dayId: "w0d0", sortOrder: 1 },
                { eventId: "next", dayId: "w0d0", sortOrder: 2 },
            ],
            dayStartTime: "12:15",
            lunchTime: "13:00",
        });

        const plan = planCut(input);
        expect(plan.ok).toBe(true);
        if (!plan.ok) return;

        // The exercise is drawn up to 14:15, so the next event may not begin
        // at its stored 13:45 end — that would overlap it on screen.
        const occ = plan.occurrences.find((o) => o.ganttEventId === "next");
        expect(occ!.startTime.toISOString()).toBe(
            venueTime("2024-01-07T14:15"),
        );
    });

    it("starts a split event after a window its slot began inside", () => {
        const lunch = makeEvent({
            id: "lunch",
            title: MEAL_EVENT_TITLES.lunchTime,
            minimumDuration: 60,
            allocatedDuration: 60,
        });
        const exercise = makeEvent({
            id: "ex",
            minimumDuration: 90,
            allocatedDuration: 90,
            splitAcrossBreaks: true,
        });
        const input = baseInput({
            events: [ lunch, exercise ],
            mappings: [
                { eventId: "lunch", dayId: "w0d0", sortOrder: 0 },
                { eventId: "ex", dayId: "w0d0", sortOrder: 1 },
            ],
            dayStartTime: "13:15", // inside the 13:00-14:00 lunch window
            lunchTime: "13:00",
        });

        const plan = planCut(input);
        expect(plan.ok).toBe(true);
        if (!plan.ok) return;

        const occ = plan.occurrences.find((o) => o.ganttEventId === "ex");
        expect(occ!.startTime.toISOString()).toBe(
            venueTime("2024-01-07T14:00"),
        );
        expect(occ!.endTime.getTime() - occ!.startTime.getTime()).toBe(90 * 60 * 1000);
    });

    it("does not extend a split event that doesn't overlap any break window", () => {
        const lunch = makeEvent({
            id: "lunch",
            title: MEAL_EVENT_TITLES.lunchTime,
            minimumDuration: 30,
            allocatedDuration: 30,
        });
        const exercise = makeEvent({
            id: "ex",
            minimumDuration: 60,
            allocatedDuration: 60,
            splitAcrossBreaks: true,
        });
        const input = baseInput({
            events: [ lunch, exercise ],
            mappings: [
                { eventId: "lunch", dayId: "w0d0", sortOrder: 0 },
                { eventId: "ex", dayId: "w0d0", sortOrder: 1 },
            ],
            dayStartTime: "08:00", // nowhere near the 13:00 lunch window
            lunchTime: "13:00",
        });

        const plan = planCut(input);
        expect(plan.ok).toBe(true);
        if (!plan.ok) return;

        const occ = plan.occurrences.find((o) => o.ganttEventId === "ex");
        expect(occ!.endTime.getTime() - occ!.startTime.getTime()).toBe(60 * 60 * 1000);
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

    it("starts Sunday at weekendHomeStartTime when the week is not on weekend duty", () => {
        const { days, weeks } = buildWeeks(1);
        weeks[0].weekendDuty = false;
        const event = makeEvent({ id: "e1" });
        const input = baseInput({
            days,
            weeks,
            events: [ event ],
            mappings: [ { eventId: "e1", dayId: "w0d0", sortOrder: 0 } ],
            dayStartTime: "08:00",
            weekendHomeStartTime: "10:00",
        });

        const plan = planCut(input);
        expect(plan.ok).toBe(true);
        if (!plan.ok) return;

        expect(plan.occurrences[0].startTime.toISOString()).toBe(
            venueTime("2024-01-07T10:00"),
        );
    });

    it("starts Sunday at the regular dayStartTime when the week is on weekend duty", () => {
        const { days, weeks } = buildWeeks(1);
        weeks[0].weekendDuty = true;
        const event = makeEvent({ id: "e1" });
        const input = baseInput({
            days,
            weeks,
            events: [ event ],
            mappings: [ { eventId: "e1", dayId: "w0d0", sortOrder: 0 } ],
            dayStartTime: "08:00",
            weekendHomeStartTime: "10:00",
        });

        const plan = planCut(input);
        expect(plan.ok).toBe(true);
        if (!plan.ok) return;

        expect(plan.occurrences[0].startTime.toISOString()).toBe(
            venueTime("2024-01-07T08:00"),
        );
    });

    it("leaves non-Sunday days at the regular dayStartTime even when off weekend duty", () => {
        const { days, weeks } = buildWeeks(1);
        weeks[0].weekendDuty = false;
        const event = makeEvent({ id: "e1" });
        const input = baseInput({
            days,
            weeks,
            events: [ event ],
            mappings: [ { eventId: "e1", dayId: "w0d1", sortOrder: 0 } ], // Monday
            dayStartTime: "08:00",
            weekendHomeStartTime: "10:00",
        });

        const plan = planCut(input);
        expect(plan.ok).toBe(true);
        if (!plan.ok) return;

        expect(plan.occurrences[0].startTime.toISOString()).toBe(
            venueTime("2024-01-08T08:00"),
        );
    });

    it("defaults to weekendDuty=true (regular start) when the flag is omitted", () => {
        const { days, weeks } = buildWeeks(1); // weekendDuty left unset
        const event = makeEvent({ id: "e1" });
        const input = baseInput({
            days,
            weeks,
            events: [ event ],
            mappings: [ { eventId: "e1", dayId: "w0d0", sortOrder: 0 } ],
            dayStartTime: "08:00",
            weekendHomeStartTime: "10:00",
        });

        const plan = planCut(input);
        expect(plan.ok).toBe(true);
        if (!plan.ok) return;

        expect(plan.occurrences[0].startTime.toISOString()).toBe(
            venueTime("2024-01-07T08:00"),
        );
    });
});

describe("planCut — venue timezone anchoring (#415)", () => {
    // The planner used to build wall-clock times through the ambient process
    // timezone, so a UTC server (the Docker default) emitted 09:30 UTC for a
    // 09:30 Asia/Jerusalem day start — displayed as 12:30 by every client.
    const withProcessTz = <T,>(tz: string, body: () => T): T => {
        const original = process.env.TZ;
        process.env.TZ = tz;
        try {
            return body();
        } finally {
            process.env.TZ = original;
        }
    };

    const planStartInstant = (): string => {
        const input = baseInput({
            events: [ makeEvent({ id: "e1" }) ],
            mappings: [ { eventId: "e1", dayId: "w0d0", sortOrder: 0 } ],
            dayStartTime: "09:30",
        });
        const plan = planCut(input);
        if (!plan.ok) throw new Error("plan failed");
        return plan.occurrences[0].startTime.toISOString();
    };

    it("computes 09:30 in the venue timezone regardless of the process TZ", () => {
        // 2024-01-07 is IST (UTC+2), so 09:30 local is 07:30Z.
        const expected = "2024-01-07T07:30:00.000Z";

        expect(withProcessTz("UTC", planStartInstant)).toBe(expected);
        expect(withProcessTz("America/New_York", planStartInstant)).toBe(expected);
        expect(withProcessTz("Asia/Jerusalem", planStartInstant)).toBe(expected);
    });

    it("stays DST-correct across the Israeli summer transition", () => {
        // 2024-08-04 is IDT (UTC+3), so the same 09:30 local is 06:30Z — the
        // exact ~3h offset reported in the bug.
        const input = baseInput({
            startDate: "2024-08-04",
            events: [ makeEvent({ id: "e1" }) ],
            mappings: [ { eventId: "e1", dayId: "w0d0", sortOrder: 0 } ],
            dayStartTime: "09:30",
        });

        const plan = planCut(input);
        expect(plan.ok).toBe(true);
        if (!plan.ok) return;

        expect(plan.occurrences[0].startTime.toISOString()).toBe(
            "2024-08-04T06:30:00.000Z",
        );
    });
});
