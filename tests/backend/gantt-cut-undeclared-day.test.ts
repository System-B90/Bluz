import { describe, expect, it } from "vitest";

import {
    ConstraintDayInfo,
    ConstraintPlacement,
    solveConstraints,
} from "@/api-shared/gantt/cut-constraints";
import {
    CutPlanDayInput,
    CutPlanEventInput,
    CutPlanInput,
    CutPlanWeekInput,
    planCut,
} from "@/api-shared/gantt/cut-planner";
import {
    ConstraintType,
    GanttConstraint,
} from "@/api-shared/types/gantt/models/constraint";
import {
    EventRecurrence,
    GanttDayIndex,
    ModuleEventType,
} from "@/api-shared/types/gantt/models";

/**
 * Regression: "Cannot read properties of undefined (reading 'loadMinutes')".
 *
 * A day with no declared window (no `dayEndTime`, no `totalWorkingMinutes`)
 * is left out of the solver's day table, but events placed on it still reach
 * the solver. When one of them broke a constraint and a legal day existed in
 * the same week, `propose` read `loadMinutes` off the missing source day and
 * the whole cut threw. Every existing test declared a window on every day,
 * and so does the e2e seed, so the path never ran.
 */

const START_DATE = "2024-01-07"; // Sunday

type DayWindow = Partial<Pick<CutPlanDayInput, "dayEndTime" | "totalWorkingMinutes">>;

/** Seven-day weeks; `window(w, d)` sets each day's declared window. */
function buildWeeks(weekCount: number, window: (w: number, d: number) => DayWindow) {
    const days: Record<string, CutPlanDayInput> = {};
    const weeks: Array<CutPlanWeekInput> = [];
    for (let w = 0; w < weekCount; w++) {
        const dayIds: Array<string> = [];
        for (let d = 0; d < 7; d++) {
            const id = `w${w}d${d}`;
            days[id] = { id, dayIndex: d as GanttDayIndex, ...window(w, d) };
            dayIds.push(id);
        }
        weeks.push({ id: `week${w}`, dayIds });
    }
    return { days, weeks };
}

const declared: DayWindow = { dayEndTime: "16:00" };
const undeclared: DayWindow = {};

function event(id: string, constraints: Array<GanttConstraint> = []): CutPlanEventInput {
    return {
        id,
        title: id,
        recurrence: EventRecurrence.None,
        minimumDuration: 60,
        splitAcrossBreaks: false,
        type: ModuleEventType.Lecture,
        constraints,
    };
}

function temporal(owner: string, allowedDays: Array<GanttDayIndex>, forbiddenDays?: Array<GanttDayIndex>) {
    return {
        id: `t-${owner}`,
        type: ConstraintType.Temporal,
        ownerType: "event",
        ownerEventId: owner,
        allowedDays,
        forbiddenDays,
    } as GanttConstraint;
}

function relational(owner: string, target: string, relation: "after" | "before", minDelayDays = 1) {
    return {
        id: `r-${owner}`,
        type: ConstraintType.Relational,
        ownerType: "event",
        ownerEventId: owner,
        relation,
        targetType: "event",
        targetId: target,
        minDelayDays,
    } as GanttConstraint;
}

function input(
    window: (w: number, d: number) => DayWindow,
    events: Array<CutPlanEventInput>,
    mappings: Array<[string, string]>,
    weekCount = 1,
): CutPlanInput {
    const { days, weeks } = buildWeeks(weekCount, window);
    return {
        startDate: START_DATE,
        weeks,
        days,
        events,
        mappings: mappings.map(([eventId, dayId], sortOrder) => ({ eventId, dayId, sortOrder, allottedMinutes: 60 })),
        recurrenceExceptions: [],
        dayStartTime: "08:00",
    };
}

function okPlan(plan: ReturnType<typeof planCut>) {
    expect(plan.ok).toBe(true);
    if (!plan.ok) throw new Error("plan failed");
    return plan;
}

/** Sunday undeclared, the rest of the week declared. */
const sundayUndeclared = (_w: number, d: number) => (d === 0 ? undeclared : declared);

describe("planCut — constrained event on an undeclared day", () => {
    it("does not throw when a temporal constraint moves it to a declared day", () => {
        const data = input(sundayUndeclared, [event("e1", [temporal("e1", [GanttDayIndex.Tuesday])])], [["e1", "w0d0"]]);
        expect(() => planCut(data)).not.toThrow();
    });

    it("proposes the move off the undeclared day", () => {
        const plan = okPlan(planCut(input(
            sundayUndeclared,
            [event("e1", [temporal("e1", [GanttDayIndex.Tuesday])])],
            [["e1", "w0d0"]],
        )));
        expect(plan.report.constraintProposals).toEqual([
            expect.objectContaining({ eventId: "e1", fromDayId: "w0d0", toDayId: "w0d2" }),
        ]);
        expect(plan.report.constraintViolations).toEqual([]);
    });

    it("applies an accepted move off the undeclared day", () => {
        const plan = okPlan(planCut(
            input(sundayUndeclared, [event("e1", [temporal("e1", [GanttDayIndex.Tuesday])])], [["e1", "w0d0"]]),
            { acceptedConstraintMoves: ["e1"] },
        ));
        const occurrence = plan.occurrences.find((o) => o.ganttEventId === "e1");
        expect(occurrence?.occurrenceDate).toBe("2024-01-09"); // Tuesday
    });

    it("does not throw for a forbidden-day constraint", () => {
        const data = input(sundayUndeclared, [event("e1", [temporal("e1", [], [GanttDayIndex.Sunday])])], [["e1", "w0d0"]]);
        expect(() => planCut(data)).not.toThrow();
    });

    it("does not throw when a relational constraint moves it", () => {
        const data = input(
            sundayUndeclared,
            [event("target"), event("e1", [relational("e1", "target", "after")])],
            [["target", "w0d1"], ["e1", "w0d0"]],
        );
        expect(() => planCut(data)).not.toThrow();
        const plan = okPlan(planCut(data));
        expect(plan.report.constraintProposals.map((p) => p.eventId)).toEqual(["e1"]);
    });

    it("does not throw with several constrained events on the undeclared day", () => {
        const events = ["a", "b", "c"].map((id) => event(id, [temporal(id, [GanttDayIndex.Monday])]));
        const data = input(sundayUndeclared, events, events.map((e) => [e.id, "w0d0"] as [string, string]));
        const plan = okPlan(planCut(data));
        expect(plan.report.constraintProposals).toHaveLength(3);
    });

    it("reports, not crashes, when every day is undeclared", () => {
        const data = input(() => undeclared, [event("e1", [temporal("e1", [GanttDayIndex.Tuesday])])], [["e1", "w0d0"]]);
        const plan = okPlan(planCut(data));
        expect(plan.report.constraintProposals).toEqual([]);
        expect(plan.report.constraintViolations).toHaveLength(1);
    });

    it("does not throw across several weeks with mixed windows", () => {
        const data = input(
            (w, d) => ((w + d) % 2 === 0 ? undeclared : declared),
            [
                event("x", [temporal("x", [GanttDayIndex.Monday])]),
                event("y", [temporal("y", [GanttDayIndex.Thursday])]),
            ],
            [["x", "w0d0"], ["y", "w1d1"]],
            2,
        );
        expect(() => planCut(data)).not.toThrow();
    });

    it("leaves a satisfied constraint alone on the undeclared day", () => {
        const plan = okPlan(planCut(input(
            sundayUndeclared,
            [event("e1", [temporal("e1", [GanttDayIndex.Sunday])])],
            [["e1", "w0d0"]],
        )));
        expect(plan.report.constraintProposals).toEqual([]);
        expect(plan.report.constraintViolations).toEqual([]);
    });

    it("never moves work onto an undeclared day", () => {
        const plan = okPlan(planCut(input(
            (_w, d) => (d === 2 ? undeclared : declared),
            [event("e1", [temporal("e1", [GanttDayIndex.Tuesday])])],
            [["e1", "w0d1"]],
        )));
        expect(plan.report.constraintProposals.map((p) => p.toDayId)).not.toContain("w0d2");
    });
});

describe("solveConstraints — source day missing from the day table", () => {
    const day = (id: string, dayIndex: GanttDayIndex, dayOrdinal: number, loadMinutes = 0): ConstraintDayInfo => ({
        id, dayIndex, weekId: "w0", dayOrdinal, capacityMinutes: 480, loadMinutes,
    });
    const placement = (eventId: string, dayId: string, dayOrdinal: number): ConstraintPlacement => ({
        eventId, moduleId: null, dayId, dayOrdinal, dayIndex: dayOrdinal as GanttDayIndex, weekId: "w0", durationMinutes: 60,
    });
    const onlyTuesday = (id: string) => ({ id, title: id, constraints: [temporal(id, [GanttDayIndex.Tuesday])] });

    it("does not throw", () => {
        expect(() => solveConstraints({
            placements: [placement("e1", "ghost", 0)],
            days: { d2: day("d2", GanttDayIndex.Tuesday, 2) },
            entities: [onlyTuesday("e1")],
            eventIdsByModule: {},
            titleByEventId: {},
        })).not.toThrow();
    });

    it("still proposes the move", () => {
        const result = solveConstraints({
            placements: [placement("e1", "ghost", 0)],
            days: { d2: day("d2", GanttDayIndex.Tuesday, 2) },
            entities: [onlyTuesday("e1")],
            eventIdsByModule: {},
            titleByEventId: {},
        });
        expect(result.proposals).toEqual([expect.objectContaining({ fromDayId: "ghost", toDayId: "d2" })]);
    });

    it("charges the load to the target day", () => {
        const result = solveConstraints({
            placements: [placement("e1", "ghost", 0), placement("e2", "ghost", 0)],
            // Room for one more hour on Tuesday.
            days: { d2: { ...day("d2", GanttDayIndex.Tuesday, 2, 60), capacityMinutes: 120 } },
            entities: [onlyTuesday("e1"), onlyTuesday("e2")],
            eventIdsByModule: {},
            titleByEventId: {},
        });
        expect(result.proposals).toHaveLength(1);
        expect(result.violations).toHaveLength(1);
    });

    it("leaves the caller's day table untouched", () => {
        const days = { d2: day("d2", GanttDayIndex.Tuesday, 2) };
        solveConstraints({
            placements: [placement("e1", "ghost", 0)],
            days,
            entities: [onlyTuesday("e1")],
            eventIdsByModule: {},
            titleByEventId: {},
        });
        expect(days.d2.loadMinutes).toBe(0);
        expect(days).not.toHaveProperty("ghost");
    });
});
