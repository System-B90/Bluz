import { describe, expect, it } from "vitest";

import { venueTime } from "./helpers/venue-time";
import { balanceWeeks, BalancerSlot } from "@/api-shared/gantt/cut-balancer";
import {
    breakKindForBoundary,
    insertBreaksForDay,
    PlacedItem,
} from "@/api-shared/gantt/cut-breaks";
import {
    CutPlanDayInput,
    CutPlanEventInput,
    CutPlanInput,
    CutPlanWeekInput,
    isGeneratedBreakEventId,
    planCut,
} from "@/api-shared/gantt/cut-planner";
import {
    BREAK_PLACEMENT_RULES,
    BREAK_RULES,
    isSpillable,
    LONG_EXERCISE_THRESHOLD_MINUTES,
    MIN_LECTURE_MINUTES_FOR_POST_BREAK,
} from "@/api-shared/gantt/cut-rules";
import { solveConstraints } from "@/api-shared/gantt/cut-constraints";
import {
    ConstraintType,
    GanttConstraint,
} from "@/api-shared/types/gantt/models/constraint";
import {
    EventRecurrence,
    GanttDayIndex,
    ModuleEventType,
} from "@/api-shared/types/gantt/models";
import { MEAL_EVENT_TITLES } from "@/api-shared/types/settings/meal";

/**
 * Behavioural suite for the three passes added on top of the cut planner:
 * the spillover balancer, the break post-pass and the constraint solver.
 *
 * Every pass is pure and takes plain data, so each rule is exercised twice:
 * once directly against the pass (unit — precise, no calendar noise) and once
 * end-to-end through `planCut` (integration — proves the wiring, timezone
 * handling and ordering hold).
 *
 * The invariants asserted here are the ones documented in
 * `docs/gantt-cut-rules.md`; a change in policy should show up as a failing
 * assertion here rather than as a silent behavioural drift.
 */

const START_DATE = "2024-01-07"; // Sunday
const DAY_START = "08:00";

/** `weekCount` seven-day weeks, day ids `w{week}d{dayIndex}`. */
function buildWeeks(
    weekCount: number,
    dayOverrides: (weekIndex: number, dayIndex: number) => Partial<CutPlanDayInput> = () => ({}),
): { days: Record<string, CutPlanDayInput>; weeks: Array<CutPlanWeekInput> } {
    const days: Record<string, CutPlanDayInput> = {};
    const weeks: Array<CutPlanWeekInput> = [];

    for (let w = 0; w < weekCount; w++) {
        const dayIds: Array<string> = [];
        for (let d = 0; d < 7; d++) {
            const id = `w${w}d${d}`;
            days[id] = {
                id,
                dayIndex: d as GanttDayIndex,
                ...dayOverrides(w, d),
            };
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
        splitAcrossBreaks: false,
        type: ModuleEventType.Lecture,
        ...overrides,
    };
}

function baseInput(overrides: Partial<CutPlanInput> = {}): CutPlanInput {
    const { days, weeks } = buildWeeks(2, () => ({ dayEndTime: "16:00" }));
    return {
        startDate: START_DATE,
        weeks,
        days,
        events: [],
        mappings: [],
        recurrenceExceptions: [],
        dayStartTime: DAY_START,
        ...overrides,
    };
}

/** Occurrences for one gantt event, sorted by start. */
const occurrencesOf = (
    plan: ReturnType<typeof planCut>,
    eventId: string,
) => {
    if (!plan.ok) throw new Error("expected a successful plan");
    return plan.occurrences
        .filter((occ) => occ.ganttEventId === eventId)
        .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
};

const datesOf = (plan: ReturnType<typeof planCut>, eventId: string) =>
    occurrencesOf(plan, eventId).map((occ) => occ.occurrenceDate);

/** Venue-local wall clock of an instant, for day-relative assertions. */
const wallClock = (instant: Date): string =>
    instant.toLocaleTimeString("en-GB", {
        timeZone: "Asia/Jerusalem",
        hour12: false,
    });

function makeSlot(overrides: Partial<BalancerSlot> & { key: string }): BalancerSlot {
    return {
        eventId: overrides.key,
        durationMinutes: 60,
        moduleId: null,
        isRecurrenceEcho: false,
        isDailyRecurrence: false,
        isPinnedMeal: false,
        sortOrder: 0,
        ...overrides,
    };
}

function makeItem(overrides: Partial<PlacedItem> & { key: string }): PlacedItem {
    return {
        startMinutes: 480,
        endMinutes: 540,
        eventType: ModuleEventType.Lecture,
        syllabusId: "s1",
        roomName: null,
        isExistingBreak: false,
        isPinned: false,
        ...overrides,
    };
}

// ---------------------------------------------------------------------------
// Day capacity
// ---------------------------------------------------------------------------

describe("cut — day capacity", () => {
    it("derives a day's end from its working minutes when no end time is set", () => {
        // 08:00 + 4h of configured work ⇒ a window closing at 12:00. Three
        // 2-hour events cannot all fit, so the third must not run past it.
        const { days, weeks } = buildWeeks(1, () => ({ totalWorkingMinutes: 240 }));
        const plan = planCut(
            baseInput({
                days,
                weeks,
                events: [1, 2, 3].map((n) =>
                    makeEvent({
                        id: `e${n}`,
                        minimumDuration: 120,
                        allocatedDuration: 120,
                    }),
                ),
                mappings: [1, 2, 3].map((n) => ({
                    eventId: `e${n}`,
                    dayId: "w0d0",
                    sortOrder: n,
                })),
            }),
            { insertBreaks: false },
        );

        expect(plan.ok).toBe(true);
        if (!plan.ok) return;
        // Every occurrence, on whichever day it landed, ends by 12:00 wall
        // clock — comparing absolute instants would just compare dates.
        for (const occ of plan.occurrences) {
            expect(wallClock(occ.endTime) <= "12:00:00").toBe(true);
        }
    });

    it("prefers an explicit dayEndTime over the derived working minutes", () => {
        // Conflicting signals: 2h of working minutes but an explicit 18:00 end.
        // The explicit window wins, so a 6-hour event still fits without wrapping.
        const { days, weeks } = buildWeeks(1, () => ({
            totalWorkingMinutes: 120,
            dayEndTime: "18:00",
        }));
        const plan = planCut(
            baseInput({
                days,
                weeks,
                events: [
                    makeEvent({
                        id: "long",
                        minimumDuration: 360,
                        allocatedDuration: 360,
                    }),
                ],
                mappings: [{ eventId: "long", dayId: "w0d0", sortOrder: 0 }],
            }),
            { insertBreaks: false },
        );

        expect(occurrencesOf(plan, "long")[0].endTime.toISOString()).toBe(
            venueTime("2024-01-07T14:00"),
        );
    });

    it("leaves a day that declares no window unbounded, exactly as before", () => {
        // No dayEndTime and no working minutes: nothing spills, nothing wraps,
        // and the stack simply runs on. This is the pre-existing behaviour and
        // must not change for curriculums that never set capacity.
        const { days, weeks } = buildWeeks(1);
        const plan = planCut(
            baseInput({
                days,
                weeks,
                events: [1, 2, 3].map((n) =>
                    makeEvent({
                        id: `e${n}`,
                        minimumDuration: 300,
                        allocatedDuration: 300,
                    }),
                ),
                mappings: [1, 2, 3].map((n) => ({
                    eventId: `e${n}`,
                    dayId: "w0d0",
                    sortOrder: n,
                })),
            }),
        );

        expect(plan.ok).toBe(true);
        if (!plan.ok) return;
        // All three stay on the mapped day, stacked end to end, past any
        // notional end time.
        expect(datesOf(plan, "e3")).toEqual(["2024-01-07"]);
        expect(occurrencesOf(plan, "e3")[0].startTime.toISOString()).toBe(
            venueTime("2024-01-07T18:00"),
        );
        expect(plan.report.moves).toEqual([]);
        expect(plan.report.breaks).toEqual([]);
    });
});

// ---------------------------------------------------------------------------
// Spillover — the balancer in isolation
// ---------------------------------------------------------------------------

describe("balanceWeeks", () => {
    const days = {
        d0: { id: "d0", dayIndex: GanttDayIndex.Sunday, capacityMinutes: 120 },
        d1: { id: "d1", dayIndex: GanttDayIndex.Monday, capacityMinutes: 120 },
        d2: { id: "d2", dayIndex: GanttDayIndex.Tuesday, capacityMinutes: 120 },
    };
    const week = { id: "w0", dayIds: ["d0", "d1", "d2"] };

    it("moves the overflow of a full day onto a later day in the same week", () => {
        const result = balanceWeeks({
            weeks: [week],
            days,
            slotsByDay: new Map([
                [
                    "d0",
                    [
                        makeSlot({ key: "a", sortOrder: 0 }),
                        makeSlot({ key: "b", sortOrder: 1 }),
                        makeSlot({ key: "c", sortOrder: 2 }),
                    ],
                ],
            ]),
        });

        expect(result.moves).toHaveLength(1);
        expect(result.moves[0].fromDayId).toBe("d0");
        expect(result.slotsByDay.get("d0")).toHaveLength(2);
        expect(result.overflows).toEqual([]);
    });

    it("cascades across several days when everything is piled onto one", () => {
        // Six hours mapped to Sunday against three 2-hour days: the balancer
        // must fill Monday and Tuesday, not just push once.
        const result = balanceWeeks({
            weeks: [week],
            days,
            slotsByDay: new Map([
                [
                    "d0",
                    [0, 1, 2, 3, 4, 5].map((n) =>
                        makeSlot({ key: `e${n}`, sortOrder: n }),
                    ),
                ],
            ]),
        });

        expect(result.slotsByDay.get("d0")).toHaveLength(2);
        expect(result.slotsByDay.get("d1")).toHaveLength(2);
        expect(result.slotsByDay.get("d2")).toHaveLength(2);
        expect(result.overflows).toEqual([]);
    });

    it("never spills onto a day that is already at capacity", () => {
        // d1 is full, d2 has room: the balancer must skip d1 entirely rather
        // than overload it. Overlap on X beats a spill into a full X+1.
        const result = balanceWeeks({
            weeks: [week],
            days,
            slotsByDay: new Map([
                [
                    "d0",
                    [
                        makeSlot({ key: "a", sortOrder: 0 }),
                        makeSlot({ key: "b", sortOrder: 1 }),
                        makeSlot({ key: "c", sortOrder: 2 }),
                    ],
                ],
                [
                    "d1",
                    [
                        makeSlot({ key: "x", sortOrder: 0 }),
                        makeSlot({ key: "y", sortOrder: 1 }),
                    ],
                ],
            ]),
        });

        expect(result.slotsByDay.get("d1")).toHaveLength(2);
        expect(result.moves[0].toDayId).toBe("d2");
    });

    it("reports an overflow instead of overloading a week that cannot fit", () => {
        // Eight hours against six of capacity — two hours have nowhere legal
        // to go, so the week is surfaced as a decision rather than absorbed.
        const result = balanceWeeks({
            weeks: [week],
            days,
            slotsByDay: new Map([
                [
                    "d0",
                    [0, 1, 2, 3, 4, 5, 6, 7].map((n) =>
                        makeSlot({ key: `e${n}`, sortOrder: n }),
                    ),
                ],
            ]),
        });

        expect(result.overflows).toHaveLength(1);
        expect(result.overflows[0].weekId).toBe("w0");
        expect(result.overflows[0].excessMinutes).toBe(120);
        expect(result.overflows[0].appliedResolution).toBe("overlap-source");
    });

    it("moves the lone event rather than splitting a module", () => {
        // d0 holds two of the three hours. Exactly one event must leave, and
        // the split penalty should pick the module-less one over tearing m2
        // apart.
        const result = balanceWeeks({
            weeks: [week],
            days,
            slotsByDay: new Map([
                [
                    "d0",
                    [
                        makeSlot({ key: "solo", moduleId: null, sortOrder: 0 }),
                        makeSlot({ key: "pair-a", moduleId: "m2", sortOrder: 1 }),
                        makeSlot({ key: "pair-b", moduleId: "m2", sortOrder: 2 }),
                    ],
                ],
            ]),
        });

        const dayOf = (key: string) =>
            [...result.slotsByDay.entries()].find(([, slots]) =>
                slots.some((slot) => slot.key === key),
            )?.[0];

        expect(result.moves).toHaveLength(1);
        expect(result.moves[0].slotKey).toBe("solo");
        expect(dayOf("pair-a")).toBe("d0");
        expect(dayOf("pair-b")).toBe("d0");
    });

    it("never moves work backwards or across a week boundary", () => {
        const twoWeeks = [
            { id: "w0", dayIds: ["d0", "d1"] },
            { id: "w1", dayIds: ["d2"] },
        ];
        const result = balanceWeeks({
            weeks: twoWeeks,
            days,
            slotsByDay: new Map([
                [
                    "d1",
                    [0, 1, 2, 3].map((n) =>
                        makeSlot({ key: `e${n}`, sortOrder: n }),
                    ),
                ],
            ]),
        });

        // d1 is the last day of its week: nothing may flow to d2 (next week)
        // and nothing may flow back to d0.
        expect(result.moves).toEqual([]);
        expect(result.slotsByDay.get("d2") ?? []).toHaveLength(0);
        expect(result.overflows).toHaveLength(1);
    });

    it("leaves relocated slots in their original relative order", () => {
        const result = balanceWeeks({
            weeks: [week],
            days,
            slotsByDay: new Map([
                [
                    "d0",
                    [0, 1, 2, 3].map((n) =>
                        makeSlot({ key: `e${n}`, sortOrder: n }),
                    ),
                ],
            ]),
        });

        for (const slots of result.slotsByDay.values()) {
            const orders = slots.map((slot) => slot.sortOrder);
            expect([...orders].sort((a, b) => a - b)).toEqual(orders);
        }
    });
});

describe("isSpillable", () => {
    it("pins meals and every daily occurrence, and frees weekly ones", () => {
        const cases: Array<[Partial<Parameters<typeof isSpillable>[0]>, boolean]> = [
            [{}, true],
            [{ isPinnedMeal: true }, false],
            // Daily is pinned on both sides of the recurrence: the anchor
            // defines the echo days, so moving it desynchronizes the pattern.
            [{ isRecurrenceEcho: true, isDailyRecurrence: true }, false],
            [{ isRecurrenceEcho: false, isDailyRecurrence: true }, false],
            // Weekly is free either way — its day is a preference.
            [{ isRecurrenceEcho: true, isDailyRecurrence: false }, true],
        ];

        for (const [overrides, expected] of cases) {
            expect(
                isSpillable({
                    isPinnedMeal: false,
                    isRecurrenceEcho: false,
                    isDailyRecurrence: false,
                    ...overrides,
                }),
            ).toBe(expected);
        }
    });
});

// ---------------------------------------------------------------------------
// Spillover — end to end through planCut
// ---------------------------------------------------------------------------

describe("cut — auto spillover", () => {
    /** Four 2-hour events on Sunday against 4-hour days. */
    const overloadedSunday = (extra: Partial<CutPlanInput> = {}) =>
        baseInput({
            days: buildWeeks(1, () => ({ dayEndTime: "12:00" })).days,
            weeks: buildWeeks(1, () => ({ dayEndTime: "12:00" })).weeks,
            events: [1, 2, 3, 4].map((n) =>
                makeEvent({
                    id: `e${n}`,
                    minimumDuration: 120,
                    allocatedDuration: 120,
                }),
            ),
            mappings: [1, 2, 3, 4].map((n) => ({
                eventId: `e${n}`,
                dayId: "w0d0",
                sortOrder: n,
            })),
            ...extra,
        });

    it("rebalances an overloaded day across the week", () => {
        const plan = planCut(overloadedSunday(), { insertBreaks: false });

        expect(plan.ok).toBe(true);
        if (!plan.ok) return;
        const dates = new Set(plan.occurrences.map((occ) => occ.occurrenceDate));
        expect(dates.size).toBeGreaterThan(1);
        expect(plan.report.moves.length).toBe(2);
    });

    it("marks relocated occurrences with the day they came from", () => {
        const plan = planCut(overloadedSunday(), { insertBreaks: false });

        expect(plan.ok).toBe(true);
        if (!plan.ok) return;
        const moved = plan.occurrences.filter((occ) => occ.spilledFromDayId);
        expect(moved.length).toBe(2);
        expect(moved.every((occ) => occ.spilledFromDayId === "w0d0")).toBe(true);
    });

    it("leaves everything on the mapped day when spillover is off", () => {
        const plan = planCut(overloadedSunday(), {
            autoSpillover: false,
            insertBreaks: false,
        });

        expect(plan.ok).toBe(true);
        if (!plan.ok) return;
        expect(
            plan.occurrences.every((occ) => occ.occurrenceDate === "2024-01-07"),
        ).toBe(true);
        expect(plan.report.moves).toEqual([]);
    });

    it("never places an event past the day's end time", () => {
        const plan = planCut(overloadedSunday(), { insertBreaks: false });

        expect(plan.ok).toBe(true);
        if (!plan.ok) return;
        for (const occ of plan.occurrences) {
            expect(wallClock(occ.endTime) <= "12:00:00").toBe(true);
        }
    });

    it("overlaps inside the window rather than running past it when a week is full", () => {
        // One day, 4-hour window, 8 hours of work and nowhere to spill: the
        // stack wraps back to the day's start instead of overflowing the day.
        const { days, weeks } = buildWeeks(1, (_w, d) => ({
            dayEndTime: d === 0 ? "12:00" : undefined,
            totalWorkingMinutes: d === 0 ? 240 : 0,
        }));
        const plan = planCut(
            baseInput({
                days,
                weeks: [{ id: "week0", dayIds: ["w0d0"] }],
                events: [1, 2, 3, 4].map((n) =>
                    makeEvent({
                        id: `e${n}`,
                        minimumDuration: 120,
                        allocatedDuration: 120,
                    }),
                ),
                mappings: [1, 2, 3, 4].map((n) => ({
                    eventId: `e${n}`,
                    dayId: "w0d0",
                    sortOrder: n,
                })),
            }),
            { insertBreaks: false },
        );

        expect(plan.ok).toBe(true);
        if (!plan.ok) return;
        // The last two wrapped back to the morning — same day, overlapping.
        expect(occurrencesOf(plan, "e3")[0].startTime.toISOString()).toBe(
            venueTime("2024-01-07T08:00"),
        );
        expect(plan.report.overflows).toHaveLength(1);
    });

    it("wraps split-across-breaks events too instead of stacking them past the end time", () => {
        // 08:00-12:00 window, lunch pinned 10:00-10:30. e1 fills the morning;
        // e2/e3 split around lunch and would end 12:30 / later, so each must
        // wrap back inside the window rather than start at (or past) 12:00.
        const { days } = buildWeeks(1, () => ({ dayEndTime: "12:00" }));
        const plan = planCut(
            baseInput({
                days,
                weeks: [{ id: "week0", dayIds: ["w0d0"] }],
                lunchTime: "10:00",
                events: [
                    makeEvent({
                        id: "lunch",
                        title: MEAL_EVENT_TITLES.lunchTime,
                        minimumDuration: 30,
                        allocatedDuration: 30,
                    }),
                    makeEvent({ id: "e1", minimumDuration: 90, allocatedDuration: 90 }),
                    makeEvent({
                        id: "e2",
                        minimumDuration: 120,
                        allocatedDuration: 120,
                        splitAcrossBreaks: true,
                    }),
                    makeEvent({
                        id: "e3",
                        minimumDuration: 120,
                        allocatedDuration: 120,
                        splitAcrossBreaks: true,
                    }),
                ],
                mappings: ["lunch", "e1", "e2", "e3"].map((id, n) => ({
                    eventId: id,
                    dayId: "w0d0",
                    sortOrder: n,
                })),
            }),
            { insertBreaks: false, autoSpillover: false },
        );

        expect(plan.ok).toBe(true);
        if (!plan.ok) return;
        // e1 08:00-09:30; e2 from 09:30 splits around lunch → ends 12:00, fits.
        expect(wallClock(occurrencesOf(plan, "e2")[0].startTime)).toBe("09:30:00");
        // e3 from 12:00 would run to 14:00 → wraps to the morning.
        expect(wallClock(occurrencesOf(plan, "e3")[0].startTime)).toBe("08:00:00");
        for (const occ of plan.occurrences) {
            expect(wallClock(occ.startTime) < "12:00:00").toBe(true);
        }
    });

    it("bumps a wrapped event past a meal window at the wrap position", () => {
        // 08:00-12:00 window, breakfast pinned 08:00-08:30. Four 2-hour
        // lectures: e1 08:30-10:30, e2 10:30-12:30 → wraps; the wrap must not
        // land it on top of breakfast at 08:00 but bump it to 08:30.
        const { days } = buildWeeks(1, () => ({ dayEndTime: "12:00" }));
        const plan = planCut(
            baseInput({
                days,
                weeks: [{ id: "week0", dayIds: ["w0d0"] }],
                breakfastTime: "08:00",
                events: [
                    makeEvent({
                        id: "breakfast",
                        title: MEAL_EVENT_TITLES.breakfastTime,
                        minimumDuration: 30,
                        allocatedDuration: 30,
                    }),
                    makeEvent({ id: "e1", minimumDuration: 120, allocatedDuration: 120 }),
                    makeEvent({ id: "e2", minimumDuration: 120, allocatedDuration: 120 }),
                ],
                mappings: ["breakfast", "e1", "e2"].map((id, n) => ({
                    eventId: id,
                    dayId: "w0d0",
                    sortOrder: n,
                })),
            }),
            { insertBreaks: false, autoSpillover: false },
        );

        expect(plan.ok).toBe(true);
        if (!plan.ok) return;
        expect(wallClock(occurrencesOf(plan, "e2")[0].startTime)).toBe("08:30:00");
    });

    it("runs past the end time only when the user chose extend-day", () => {
        const { days } = buildWeeks(1, () => ({ dayEndTime: "12:00" }));
        const input = baseInput({
            days,
            weeks: [{ id: "week0", dayIds: ["w0d0"] }],
            events: [1, 2, 3].map((n) =>
                makeEvent({
                    id: `e${n}`,
                    minimumDuration: 120,
                    allocatedDuration: 120,
                }),
            ),
            mappings: [1, 2, 3].map((n) => ({
                eventId: `e${n}`,
                dayId: "w0d0",
                sortOrder: n,
            })),
        });

        const plan = planCut(input, {
            insertBreaks: false,
            weekOverflowResolutions: { week0: "extend-day" },
        });

        expect(occurrencesOf(plan, "e3")[0].endTime.toISOString()).toBe(
            venueTime("2024-01-07T14:00"),
        );
    });

    it("never moves a daily recurrence — anchor or echo", () => {
        // A daily event echoes onto every day; a weekly one echoes each Sunday.
        // Only the weekly echo may be rebalanced away from a full day.
        const { days, weeks } = buildWeeks(1, () => ({ dayEndTime: "10:00" }));
        const plan = planCut(
            baseInput({
                days,
                weeks,
                events: [
                    makeEvent({
                        id: "daily",
                        recurrence: EventRecurrence.Daily,
                        minimumDuration: 60,
                        allocatedDuration: 60,
                    }),
                    makeEvent({
                        id: "filler",
                        minimumDuration: 120,
                        allocatedDuration: 120,
                    }),
                ],
                mappings: [
                    { eventId: "daily", dayId: "w0d0", sortOrder: 0 },
                    { eventId: "filler", dayId: "w0d0", sortOrder: 1 },
                ],
            }),
            { insertBreaks: false },
        );

        expect(plan.ok).toBe(true);
        if (!plan.ok) return;
        // Still one occurrence per day of the week, mapped day included —
        // relocating the anchor would have emptied 2024-01-07 and doubled up
        // wherever it landed.
        expect(new Set(datesOf(plan, "daily")).size).toBe(7);
        expect(datesOf(plan, "daily")).toContain("2024-01-07");
        expect(
            plan.report.moves.every((move) => move.eventId !== "daily"),
        ).toBe(true);
    });

    it("never relocates a pinned meal event", () => {
        const { days, weeks } = buildWeeks(1, () => ({ dayEndTime: "11:00" }));
        const plan = planCut(
            baseInput({
                days,
                weeks,
                lunchTime: "13:00",
                events: [
                    makeEvent({
                        id: "lunch",
                        title: MEAL_EVENT_TITLES.lunchTime,
                        minimumDuration: 90,
                        allocatedDuration: 90,
                    }),
                    ...[1, 2, 3].map((n) =>
                        makeEvent({
                            id: `e${n}`,
                            minimumDuration: 120,
                            allocatedDuration: 120,
                        }),
                    ),
                ],
                mappings: [
                    { eventId: "lunch", dayId: "w0d0", sortOrder: 0 },
                    ...[1, 2, 3].map((n) => ({
                        eventId: `e${n}`,
                        dayId: "w0d0",
                        sortOrder: n,
                    })),
                ],
            }),
            { insertBreaks: false },
        );

        expect(datesOf(plan, "lunch")).toEqual(["2024-01-07"]);
        expect(occurrencesOf(plan, "lunch")[0].startTime.toISOString()).toBe(
            venueTime("2024-01-07T13:00"),
        );
    });

    it("never schedules onto Saturday", () => {
        const { days, weeks } = buildWeeks(1, (_w, d) => ({
            // Only Friday and Saturday have room; Saturday must stay empty.
            dayEndTime: d >= 5 ? "20:00" : "09:00",
        }));
        const plan = planCut(
            baseInput({
                days,
                weeks,
                events: [1, 2, 3].map((n) =>
                    makeEvent({
                        id: `e${n}`,
                        minimumDuration: 120,
                        allocatedDuration: 120,
                    }),
                ),
                mappings: [1, 2, 3].map((n) => ({
                    eventId: `e${n}`,
                    dayId: "w0d0",
                    sortOrder: n,
                })),
            }),
            { insertBreaks: false },
        );

        expect(plan.ok).toBe(true);
        if (!plan.ok) return;
        // 2024-01-13 is the Saturday of this week.
        expect(
            plan.occurrences.some((occ) => occ.occurrenceDate === "2024-01-13"),
        ).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// Breaks
// ---------------------------------------------------------------------------

describe("breakKindForBoundary", () => {
    const lecture = makeItem({ key: "l", eventType: ModuleEventType.Lecture });
    const exercise = makeItem({ key: "x", eventType: ModuleEventType.Exercise });

    it("earns the long-exercise break once the run reaches the threshold", () => {
        expect(
            breakKindForBoundary(
                exercise,
                lecture,
                LONG_EXERCISE_THRESHOLD_MINUTES,
                LONG_EXERCISE_THRESHOLD_MINUTES,
            ),
        ).toBe("post-long-exercise");
        expect(
            breakKindForBoundary(
                exercise,
                lecture,
                LONG_EXERCISE_THRESHOLD_MINUTES - 1,
                // Also below the post-lecture cumulative threshold, so
                // neither rule fires — isolates the long-exercise check.
                MIN_LECTURE_MINUTES_FOR_POST_BREAK - 1,
            ),
        ).toBeNull();
    });

    it("separates consecutive lectures from different syllabuses", () => {
        expect(
            breakKindForBoundary(
                lecture,
                makeItem({ key: "other", syllabusId: "s2" }),
                30,
                30,
            ),
        ).toBe("between-syllabuses");
    });

    it("falls back to a post-lecture break once the cumulative lecture/ע\"ע run reaches the threshold", () => {
        expect(
            breakKindForBoundary(
                lecture,
                makeItem({ key: "same" }),
                30,
                MIN_LECTURE_MINUTES_FOR_POST_BREAK,
            ),
        ).toBe("post-lecture");
    });

    it("withholds the post-lecture break below the cumulative threshold", () => {
        // A single short lecture, or a short run of them, earns no breather —
        // only once the consecutive lecture/ע"ע run reaches the threshold.
        expect(
            breakKindForBoundary(
                lecture,
                makeItem({ key: "same" }),
                30,
                MIN_LECTURE_MINUTES_FOR_POST_BREAK - 1,
            ),
        ).toBeNull();
    });

    it("never places a break against an existing הפסקה, on either side", () => {
        expect(
            breakKindForBoundary(
                lecture,
                makeItem({ key: "meal", isExistingBreak: true }),
                30,
                MIN_LECTURE_MINUTES_FOR_POST_BREAK,
            ),
        ).toBeNull();
        expect(
            breakKindForBoundary(
                makeItem({ key: "meal", isExistingBreak: true }),
                lecture,
                30,
                MIN_LECTURE_MINUTES_FOR_POST_BREAK,
            ),
        ).toBeNull();
    });

    it("keeps the disabled room-change rule inert", () => {
        // Two self-teaching events in different rooms: the only rule that could
        // apply is room-change, which ships disabled.
        expect(
            breakKindForBoundary(
                makeItem({
                    key: "a",
                    eventType: ModuleEventType.SelfTeaching,
                    roomName: "כיתה 1",
                }),
                makeItem({
                    key: "b",
                    eventType: ModuleEventType.SelfTeaching,
                    roomName: "כיתה 2",
                }),
                30,
                30,
            ),
        ).toBeNull();
        expect(BREAK_RULES["room-change"].enabled).toBe(false);
    });
});

describe("insertBreaksForDay", () => {
    /** Three back-to-back lectures, 08:00–11:00, in a window closing later. */
    const threeLectures = (dayEndMinutes: number) =>
        insertBreaksForDay({
            dayEndMinutes,
            prayers: [],
            items: [
                makeItem({ key: "a", startMinutes: 480, endMinutes: 540 }),
                makeItem({ key: "b", startMinutes: 540, endMinutes: 600 }),
                makeItem({ key: "c", startMinutes: 600, endMinutes: 660 }),
            ],
        });

    it("spreads the trailing slack into breaks between the events", () => {
        const result = threeLectures(690); // 30 minutes of slack

        expect(result.breaks.length).toBeGreaterThan(0);
        expect(result.breaks.every((b) => b.endMinutes > b.startMinutes)).toBe(true);
    });

    it("never pushes the day past its end time", () => {
        const result = threeLectures(690);
        const lastEnd = Math.max(
            ...result.items.map((item) => item.endMinutes),
            ...result.breaks.map((b) => b.endMinutes),
        );
        expect(lastEnd).toBeLessThanOrEqual(690);
    });

    it("inserts nothing when there is no slack at all", () => {
        const result = threeLectures(660);
        expect(result.breaks).toEqual([]);
        expect(result.items.map((i) => i.startMinutes)).toEqual([480, 540, 600]);
    });

    it("satisfies the higher-priority rule first when slack is scarce", () => {
        // Only 15 minutes of slack, two candidate boundaries: the long-ע"ע
        // break outranks the plain post-lecture one.
        const result = insertBreaksForDay({
            dayEndMinutes: 675,
            prayers: [],
            items: [
                makeItem({
                    key: "drill",
                    eventType: ModuleEventType.Exercise,
                    startMinutes: 480,
                    endMinutes: 600,
                }),
                makeItem({ key: "lec", startMinutes: 600, endMinutes: 660 }),
                makeItem({ key: "tail", startMinutes: 660, endMinutes: 660 }),
            ],
        });

        expect(result.breaks[0].kind).toBe("post-long-exercise");
    });

    it("never grows a single break past the implicit-break ceiling", () => {
        // A whole spare afternoon: no one break may swell into a dead zone.
        const result = threeLectures(1200);
        for (const generated of result.breaks) {
            expect(generated.endMinutes - generated.startMinutes).toBeLessThanOrEqual(
                BREAK_PLACEMENT_RULES.implicitBreakCeilingMinutes,
            );
        }
    });

    it("prefers a boundary that covers a prayer window", () => {
        // Two equally-eligible boundaries; only the second lands on מנחה.
        const result = insertBreaksForDay({
            dayEndMinutes: 675,
            prayers: [{ name: "מנחה", startMinutes: 600, endMinutes: 620 }],
            items: [
                makeItem({ key: "a", startMinutes: 480, endMinutes: 540 }),
                makeItem({ key: "b", startMinutes: 540, endMinutes: 600 }),
                makeItem({ key: "c", startMinutes: 600, endMinutes: 660 }),
            ],
        });

        expect(result.breaks[0].coversPrayer).toBe("מנחה");
    });

    it("shifts unpinned events later but leaves pinned meals on their clock time", () => {
        const result = insertBreaksForDay({
            dayEndMinutes: 800,
            prayers: [],
            items: [
                makeItem({ key: "a", startMinutes: 480, endMinutes: 540 }),
                makeItem({ key: "b", startMinutes: 540, endMinutes: 600 }),
                makeItem({
                    key: "lunch",
                    startMinutes: 780,
                    endMinutes: 800,
                    isPinned: true,
                    isExistingBreak: true,
                }),
            ],
        });

        const lunch = result.items.find((item) => item.key === "lunch");
        expect(lunch?.startMinutes).toBe(780);
    });

    it("does nothing for a day with fewer than two events", () => {
        expect(
            insertBreaksForDay({
                dayEndMinutes: 1200,
                prayers: [],
                items: [makeItem({ key: "only" })],
            }).breaks,
        ).toEqual([]);
    });

    it("never shifts a pre-meal event into a pinned meal when the slack sits after it", () => {
        // A 08:00-09:00, B 09:00-10:00 (other syllabus), C 10:00-12:50, lunch
        // pinned 13:00-14:30, D 14:30-16:30, day ends 17:00. The 30 minutes of
        // slack are *after* lunch; breaks before lunch may only use the 10
        // minutes between C and the pin, never push C over 13:00.
        const result = insertBreaksForDay({
            dayEndMinutes: 1020,
            prayers: [],
            items: [
                makeItem({ key: "a", startMinutes: 480, endMinutes: 540, syllabusId: "s1" }),
                makeItem({ key: "b", startMinutes: 540, endMinutes: 600, syllabusId: "s2" }),
                makeItem({ key: "c", startMinutes: 600, endMinutes: 770, syllabusId: "s2" }),
                makeItem({
                    key: "lunch",
                    startMinutes: 780,
                    endMinutes: 870,
                    isPinned: true,
                    isExistingBreak: true,
                }),
                makeItem({ key: "d", startMinutes: 870, endMinutes: 990, syllabusId: "s3" }),
            ],
        });

        const byKey = new Map(result.items.map((item) => [item.key, item]));
        expect(byKey.get("lunch")?.startMinutes).toBe(780);
        expect(byKey.get("c")!.endMinutes).toBeLessThanOrEqual(780);
        expect(byKey.get("d")!.endMinutes).toBeLessThanOrEqual(1020);
        for (const generated of result.breaks) {
            const overlapsLunch =
                generated.startMinutes < 870 && generated.endMinutes > 780;
            expect(overlapsLunch).toBe(false);
        }
        // Events never overlap each other or a break after the pass.
        const spans = [...result.items, ...result.breaks]
            .map((entry) => [entry.startMinutes, entry.endMinutes] as const)
            .sort((x, y) => x[0] - y[0]);
        for (let i = 1; i < spans.length; i++) {
            expect(spans[i][0]).toBeGreaterThanOrEqual(spans[i - 1][1]);
        }
    });
});

describe("cut — break post-pass end to end", () => {
    /** A day with three lectures and a generous window to break up. */
    const dayWithSlack = () => {
        const { days, weeks } = buildWeeks(1, () => ({ dayEndTime: "12:00" }));
        return baseInput({
            days,
            weeks,
            events: [1, 2, 3].map((n) =>
                makeEvent({
                    id: `e${n}`,
                    minimumDuration: 60,
                    allocatedDuration: 60,
                    syllabusId: `s${n}`,
                }),
            ),
            mappings: [1, 2, 3].map((n) => ({
                eventId: `e${n}`,
                dayId: "w0d0",
                sortOrder: n,
            })),
        });
    };

    it("materializes breaks as occurrences with a cut-break provenance id", () => {
        const plan = planCut(dayWithSlack());

        expect(plan.ok).toBe(true);
        if (!plan.ok) return;
        const breaks = plan.occurrences.filter((occ) =>
            isGeneratedBreakEventId(occ.ganttEventId),
        );
        expect(breaks.length).toBeGreaterThan(0);
        expect(breaks.every((b) => b.generatedBreak?.title === "הפסקה")).toBe(true);
        expect(plan.report.breaks.length).toBe(breaks.length);
    });

    it("creates no breaks when the pass is switched off", () => {
        const plan = planCut(dayWithSlack(), { insertBreaks: false });

        expect(plan.ok).toBe(true);
        if (!plan.ok) return;
        expect(
            plan.occurrences.some((occ) =>
                isGeneratedBreakEventId(occ.ganttEventId),
            ),
        ).toBe(false);
    });

    it("keeps every break inside the day's working window", () => {
        const plan = planCut(dayWithSlack());

        expect(plan.ok).toBe(true);
        if (!plan.ok) return;
        for (const occ of plan.occurrences) {
            expect(occ.endTime.getTime()).toBeLessThanOrEqual(
                new Date(venueTime("2024-01-07T12:00")).getTime(),
            );
        }
    });
});

// ---------------------------------------------------------------------------
// Constraints
// ---------------------------------------------------------------------------

describe("solveConstraints", () => {
    const dayInfo = (
        id: string,
        dayIndex: GanttDayIndex,
        ordinal: number,
        loadMinutes = 0,
    ) => ({
        id,
        dayIndex,
        weekId: "w0",
        dayOrdinal: ordinal,
        capacityMinutes: 480,
        loadMinutes,
    });

    const days = {
        d0: dayInfo("d0", GanttDayIndex.Sunday, 0),
        d1: dayInfo("d1", GanttDayIndex.Monday, 1),
        d2: dayInfo("d2", GanttDayIndex.Tuesday, 2),
    };

    const placement = (eventId: string, dayId: string, ordinal: number) => ({
        eventId,
        moduleId: null,
        dayId,
        dayOrdinal: ordinal,
        dayIndex: ordinal as GanttDayIndex,
        weekId: "w0",
        durationMinutes: 60,
    });

    const temporal = (allowedDays: Array<GanttDayIndex>): GanttConstraint =>
        ({
            id: "c1",
            type: ConstraintType.Temporal,
            ownerType: "event",
            ownerEventId: "e1",
            allowedDays,
        }) as GanttConstraint;

    it("proposes a move onto an allowed weekday", () => {
        const result = solveConstraints({
            placements: [placement("e1", "d0", 0)],
            days,
            entities: [
                { id: "e1", title: "e1", constraints: [temporal([GanttDayIndex.Tuesday])] },
            ],
            eventIdsByModule: {},
            titleByEventId: { e1: "e1" },
        });

        expect(result.proposals).toHaveLength(1);
        expect(result.proposals[0].toDayId).toBe("d2");
        expect(result.violations).toEqual([]);
    });

    it("does not mutate the caller's placement objects (#544/16)", () => {
        const callerPlacement = placement("e1", "d0", 0);
        const snapshot = { ...callerPlacement };

        const result = solveConstraints({
            placements: [callerPlacement],
            days,
            entities: [
                { id: "e1", title: "e1", constraints: [temporal([GanttDayIndex.Tuesday])] },
            ],
            eventIdsByModule: {},
            titleByEventId: { e1: "e1" },
        });

        // The pass still proposes the move...
        expect(result.proposals).toHaveLength(1);
        // ...but the caller's own placement object is untouched.
        expect(callerPlacement).toEqual(snapshot);
    });

    it("drops a violation that a later pass resolved", () => {
        // e1 must be on Tuesday but d2 is full on pass 0. e2 (also on d2)
        // must leave it, which frees room; pass 1 then moves e1 — so no
        // violation may remain in the final report.
        const fullDays = {
            ...days,
            d2: dayInfo("d2", GanttDayIndex.Tuesday, 2, 480),
        };
        const e2Temporal = {
            ...temporal([GanttDayIndex.Sunday, GanttDayIndex.Monday]),
            id: "c2",
            ownerEventId: "e2",
        } as GanttConstraint;

        const result = solveConstraints({
            placements: [placement("e1", "d0", 0), placement("e2", "d2", 2)],
            days: fullDays,
            entities: [
                { id: "e1", title: "e1", constraints: [temporal([GanttDayIndex.Tuesday])] },
                { id: "e2", title: "e2", constraints: [e2Temporal] },
            ],
            eventIdsByModule: {},
            titleByEventId: { e1: "e1", e2: "e2" },
        });

        expect(result.proposals.map((p) => [p.eventId, p.toDayId])).toEqual([
            ["e2", "d1"],
            ["e1", "d2"],
        ]);
        expect(result.violations).toEqual([]);
    });

    it("reports a constraint that a later pass broke", () => {
        // e1 "before" e2 holds on pass 0 (d0 < d1). e2 is then pulled onto
        // Sunday by its own weekday constraint, leaving e1 nowhere earlier
        // to go — the final report must carry that violation.
        const before: GanttConstraint = {
            id: "c1",
            type: ConstraintType.Relational,
            ownerType: "event",
            ownerEventId: "e1",
            relation: "before",
            targetType: "event",
            targetId: "e2",
            minDelayDays: 1,
        } as GanttConstraint;
        const e2Temporal = {
            ...temporal([GanttDayIndex.Sunday]),
            id: "c2",
            ownerEventId: "e2",
        } as GanttConstraint;

        const result = solveConstraints({
            placements: [placement("e1", "d0", 0), placement("e2", "d1", 1)],
            days,
            entities: [
                { id: "e1", title: "e1", constraints: [before] },
                { id: "e2", title: "e2", constraints: [e2Temporal] },
            ],
            eventIdsByModule: {},
            titleByEventId: { e1: "e1", e2: "e2" },
        });

        expect(result.proposals.map((p) => [p.eventId, p.toDayId])).toEqual([["e2", "d0"]]);
        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]).toMatchObject({ ownerId: "e1", kind: "relational" });
    });

    it("reports a violation when no allowed day exists in the week", () => {
        const result = solveConstraints({
            placements: [placement("e1", "d0", 0)],
            days,
            entities: [
                {
                    id: "e1",
                    title: "e1",
                    constraints: [temporal([GanttDayIndex.Friday])],
                },
            ],
            eventIdsByModule: {},
            titleByEventId: { e1: "e1" },
        });

        expect(result.proposals).toEqual([]);
        expect(result.violations).toHaveLength(1);
        expect(result.violations[0].kind).toBe("temporal");
    });

    it("leaves a placement alone when it already satisfies its constraint", () => {
        const result = solveConstraints({
            placements: [placement("e1", "d0", 0)],
            days,
            entities: [
                {
                    id: "e1",
                    title: "e1",
                    constraints: [temporal([GanttDayIndex.Sunday])],
                },
            ],
            eventIdsByModule: {},
            titleByEventId: { e1: "e1" },
        });

        expect(result.proposals).toEqual([]);
        expect(result.violations).toEqual([]);
    });

    it("orders a dependent after its target, honouring a minimum delay", () => {
        const after: GanttConstraint = {
            id: "c2",
            type: ConstraintType.Relational,
            ownerType: "event",
            ownerEventId: "dep",
            targetId: "anchor",
            targetType: "event",
            relation: "after",
            minDelayDays: 2,
        } as GanttConstraint;

        const result = solveConstraints({
            placements: [placement("anchor", "d0", 0), placement("dep", "d0", 0)],
            days,
            entities: [{ id: "dep", title: "dep", constraints: [after] }],
            eventIdsByModule: {},
            titleByEventId: { anchor: "anchor", dep: "dep" },
        });

        expect(result.proposals).toHaveLength(1);
        expect(result.proposals[0].eventId).toBe("dep");
        expect(result.proposals[0].toDayId).toBe("d2");
    });

    it("refuses a move that would break the target day's capacity", () => {
        // The only allowed day is already full, and capacity outranks
        // constraints — so this is a violation, not a proposal.
        const result = solveConstraints({
            placements: [placement("e1", "d0", 0)],
            days: {
                ...days,
                d2: dayInfo("d2", GanttDayIndex.Tuesday, 2, 480),
            },
            entities: [
                {
                    id: "e1",
                    title: "e1",
                    constraints: [temporal([GanttDayIndex.Tuesday])],
                },
            ],
            eventIdsByModule: {},
            titleByEventId: { e1: "e1" },
        });

        expect(result.proposals).toEqual([]);
        expect(result.violations).toHaveLength(1);
    });

    it("fans a module-owned constraint out to every event in the module", () => {
        const result = solveConstraints({
            placements: [placement("e1", "d0", 0), placement("e2", "d0", 0)],
            days,
            entities: [
                {
                    id: "m1",
                    title: "m1",
                    constraints: [
                        {
                            id: "c3",
                            type: ConstraintType.Temporal,
                            ownerType: "module",
                            ownerModuleId: "m1",
                            allowedDays: [GanttDayIndex.Monday],
                        } as GanttConstraint,
                    ],
                },
            ],
            eventIdsByModule: { m1: ["e1", "e2"] },
            titleByEventId: { e1: "e1", e2: "e2" },
        });

        expect(result.proposals.map((p) => p.eventId).sort()).toEqual(["e1", "e2"]);
    });

    it("terminates on a cyclic constraint graph", () => {
        const cyclic = (id: string, owner: string, target: string): GanttConstraint =>
            ({
                id,
                type: ConstraintType.Relational,
                ownerType: "event",
                ownerEventId: owner,
                targetId: target,
                targetType: "event",
                relation: "after",
                minDelayDays: 1,
            }) as GanttConstraint;

        const result = solveConstraints({
            placements: [placement("a", "d0", 0), placement("b", "d0", 0)],
            days,
            entities: [
                { id: "a", title: "a", constraints: [cyclic("c4", "a", "b")] },
                { id: "b", title: "b", constraints: [cyclic("c5", "b", "a")] },
            ],
            eventIdsByModule: {},
            titleByEventId: { a: "a", b: "b" },
        });

        // The assertion that matters is that we got here at all.
        expect(Array.isArray(result.proposals)).toBe(true);
    });
});

describe("cut — constraints end to end", () => {
    const withConstraint = (constraint: GanttConstraint) => {
        const { days, weeks } = buildWeeks(1, () => ({ dayEndTime: "16:00" }));
        return baseInput({
            days,
            weeks,
            events: [
                makeEvent({ id: "e1", constraints: [constraint] }),
                makeEvent({ id: "e2" }),
            ],
            mappings: [
                { eventId: "e1", dayId: "w0d0", sortOrder: 0 },
                { eventId: "e2", dayId: "w0d0", sortOrder: 1 },
            ],
        });
    };

    const tuesdayOnly: GanttConstraint = {
        id: "c1",
        type: ConstraintType.Temporal,
        ownerType: "event",
        ownerEventId: "e1",
        allowedDays: [GanttDayIndex.Tuesday],
    } as GanttConstraint;

    it("reports a proposal without moving anything by default", () => {
        const plan = planCut(withConstraint(tuesdayOnly), { insertBreaks: false });

        expect(plan.ok).toBe(true);
        if (!plan.ok) return;
        expect(plan.report.constraintProposals).toHaveLength(1);
        // Nothing moved — the user has not accepted it yet.
        expect(datesOf(plan, "e1")).toEqual(["2024-01-07"]);
        expect(
            plan.report.decisions.some((d) => d.type === "constraint-moves"),
        ).toBe(true);
    });

    it("applies the move once the user accepts it", () => {
        const plan = planCut(withConstraint(tuesdayOnly), {
            insertBreaks: false,
            acceptedConstraintMoves: ["e1"],
        });

        // 2024-01-09 is the Tuesday of this week.
        expect(datesOf(plan, "e1")).toEqual(["2024-01-09"]);
    });

    it("surfaces an unsatisfiable constraint as a decision, not a failure", () => {
        const impossible: GanttConstraint = {
            id: "c2",
            type: ConstraintType.Temporal,
            ownerType: "event",
            ownerEventId: "e1",
            allowedDays: [GanttDayIndex.Saturday],
        } as GanttConstraint;

        const plan = planCut(withConstraint(impossible), { insertBreaks: false });

        expect(plan.ok).toBe(true);
        if (!plan.ok) return;
        expect(plan.report.constraintViolations).toHaveLength(1);
        expect(
            plan.report.decisions.some((d) => d.type === "constraint-violation"),
        ).toBe(true);
        // The event is still cut, on its mapped day.
        expect(datesOf(plan, "e1")).toEqual(["2024-01-07"]);
    });
});

// ---------------------------------------------------------------------------
// Decisions
// ---------------------------------------------------------------------------

describe("cut — decisions", () => {
    it("raises no questions for a plan that balances cleanly", () => {
        const { days, weeks } = buildWeeks(1, () => ({ dayEndTime: "16:00" }));
        const plan = planCut(
            baseInput({
                days,
                weeks,
                events: [makeEvent({ id: "e1" })],
                mappings: [{ eventId: "e1", dayId: "w0d0", sortOrder: 0 }],
            }),
        );

        expect(plan.ok).toBe(true);
        if (!plan.ok) return;
        expect(plan.report.decisions).toEqual([]);
    });

    it("numbers an overflowing week for the dialog prompt", () => {
        const { days } = buildWeeks(2, () => ({ dayEndTime: "09:00" }));
        const plan = planCut(
            baseInput({
                days,
                weeks: [
                    { id: "week0", dayIds: ["w0d0"] },
                    { id: "week1", dayIds: ["w1d0"] },
                ],
                events: [1, 2, 3].map((n) =>
                    makeEvent({
                        id: `e${n}`,
                        minimumDuration: 60,
                        allocatedDuration: 60,
                    }),
                ),
                mappings: [1, 2, 3].map((n) => ({
                    eventId: `e${n}`,
                    dayId: "w1d0",
                    sortOrder: n,
                })),
            }),
            { insertBreaks: false },
        );

        expect(plan.ok).toBe(true);
        if (!plan.ok) return;
        const overflow = plan.report.decisions.find(
            (d) => d.type === "week-overflow",
        );
        expect(overflow).toBeDefined();
        if (overflow?.type !== "week-overflow") return;
        expect(overflow.weekNumber).toBe(2);
        expect(overflow.excessMinutes).toBeGreaterThan(0);
    });
});
