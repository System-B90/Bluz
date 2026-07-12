import { describe, expect, it } from "vitest";

import { PlannedOccurrence } from "@/api-shared/gantt/cut-planner";
import {
    buildEventExecution,
    minutesBetween,
    sameInstructorSets,
} from "@/api-shared/gantt/execution";
import { DbEventDocument } from "@/api-shared/types/event";

/**
 * Unit tests for the pure תכנון מול ביצוע join (#120): planned occurrences vs
 * the schedule events cut from them.
 */

function planned(over: Partial<PlannedOccurrence> = {}): PlannedOccurrence {
    return {
        ganttEventId: "e1",
        occurrenceDate: "2024-01-07",
        startTime: new Date("2024-01-07T08:00:00"),
        endTime: new Date("2024-01-07T09:00:00"),
        isRecurrenceEcho: false,
        ...over,
    };
}

function actualDoc(over: Partial<DbEventDocument> = {}): DbEventDocument {
    return {
        id: "sched-1",
        name: "אירוע",
        startTime: new Date("2024-01-07T08:00:00"),
        endTime: new Date("2024-01-07T09:00:00"),
        instructors: [],
        ganttEventId: "e1",
        ganttOccurrenceDate: "2024-01-07",
        ...over,
    } as DbEventDocument;
}

function build(args: {
    plannedOccurrences?: Array<PlannedOccurrence>;
    plannedInstructorIds?: Array<number>;
    scheduleEvents?: Array<DbEventDocument>;
}) {
    return buildEventExecution({
        ganttEventId: "e1",
        plannedOccurrences: args.plannedOccurrences ?? [],
        plannedInstructorIds: args.plannedInstructorIds ?? [],
        scheduleEvents: args.scheduleEvents ?? [],
    });
}

describe("minutesBetween", () => {
    it("computes whole minutes and rounds sub-minute drift", () => {
        expect(
            minutesBetween(
                new Date("2024-01-07T08:00:00"),
                new Date("2024-01-07T09:30:00"),
            ),
        ).toBe(90);
        expect(
            minutesBetween(
                new Date("2024-01-07T08:00:00.000"),
                new Date("2024-01-07T08:00:29.000"),
            ),
        ).toBe(0);
        expect(
            minutesBetween(
                new Date("2024-01-07T08:00:00.000"),
                new Date("2024-01-07T08:00:31.000"),
            ),
        ).toBe(1);
    });
});

describe("sameInstructorSets", () => {
    it("ignores order, catches missing/extra members", () => {
        expect(sameInstructorSets([1, 2], [2, 1])).toBe(true);
        expect(sameInstructorSets([], [])).toBe(true);
        expect(sameInstructorSets([1], [1, 2])).toBe(false);
        expect(sameInstructorSets([1, 2], [1])).toBe(false);
        expect(sameInstructorSets([1, 2], [1, 3])).toBe(false);
    });
});

describe("buildEventExecution — matching", () => {
    it("marks an untouched occurrence as not drifted", () => {
        const result = build({
            plannedOccurrences: [planned()],
            scheduleEvents: [actualDoc()],
        });

        expect(result.drifted).toBe(false);
        expect(result.occurrences).toHaveLength(1);
        const occ = result.occurrences[0];
        expect(occ.drifted).toBe(false);
        expect(occ.actual?.eventId).toBe("sched-1");
        expect(occ.planned?.durationMinutes).toBe(60);
        expect(occ.actual?.durationMinutes).toBe(60);
    });

    it("marks a moved occurrence (time changed) as drifted", () => {
        const result = build({
            plannedOccurrences: [planned()],
            scheduleEvents: [
                actualDoc({
                    startTime: new Date("2024-01-07T10:00:00"),
                    endTime: new Date("2024-01-07T11:00:00"),
                }),
            ],
        });
        expect(result.occurrences[0].drifted).toBe(true);
        expect(result.drifted).toBe(true);
    });

    it("marks a duration change as drifted even when the start is unchanged", () => {
        const result = build({
            plannedOccurrences: [planned()],
            scheduleEvents: [
                actualDoc({ endTime: new Date("2024-01-07T09:45:00") }),
            ],
        });
        expect(result.occurrences[0].drifted).toBe(true);
        expect(result.occurrences[0].actual?.durationMinutes).toBe(105);
    });

    it("marks an instructor change as drifted", () => {
        const result = build({
            plannedOccurrences: [planned()],
            plannedInstructorIds: [42],
            scheduleEvents: [actualDoc({ instructors: [43] })],
        });
        expect(result.occurrences[0].drifted).toBe(true);
    });

    it("treats identical instructor sets in different order as not drifted", () => {
        const result = build({
            plannedOccurrences: [planned()],
            plannedInstructorIds: [1],
            scheduleEvents: [actualDoc({ instructors: [1] })],
        });
        expect(result.occurrences[0].drifted).toBe(false);
    });
});

describe("buildEventExecution — deletions", () => {
    it("renders an archived (deleted) occurrence as actual: null and drifted", () => {
        const result = build({
            plannedOccurrences: [planned()],
            scheduleEvents: [actualDoc({ archived: true })],
        });
        const occ = result.occurrences[0];
        expect(occ.actual).toBeNull();
        expect(occ.drifted).toBe(true);
        expect(result.totals.occurrencesPlanned).toBe(1);
        expect(result.totals.occurrencesActual).toBe(0);
    });

    it("a missing schedule event (never cut occurrence) counts as deleted", () => {
        const result = build({
            plannedOccurrences: [
                planned(),
                planned({
                    occurrenceDate: "2024-01-08",
                    startTime: new Date("2024-01-08T08:00:00"),
                    endTime: new Date("2024-01-08T09:00:00"),
                }),
            ],
            scheduleEvents: [actualDoc()],
        });
        const missing = result.occurrences.find(
            (o) => o.occurrenceDate === "2024-01-08",
        );
        expect(missing?.actual).toBeNull();
        expect(missing?.drifted).toBe(true);
    });
});

describe("buildEventExecution — orphaned actuals", () => {
    it("surfaces a schedule event whose planned occurrence no longer exists", () => {
        const result = build({
            plannedOccurrences: [planned()],
            scheduleEvents: [
                actualDoc(),
                actualDoc({
                    id: "sched-2",
                    ganttOccurrenceDate: "2024-01-20",
                    startTime: new Date("2024-01-20T08:00:00"),
                    endTime: new Date("2024-01-20T09:00:00"),
                }),
            ],
        });
        expect(result.occurrences).toHaveLength(2);
        const orphan = result.occurrences.find(
            (o) => o.occurrenceDate === "2024-01-20",
        );
        expect(orphan?.planned).toBeNull();
        expect(orphan?.actual?.eventId).toBe("sched-2");
        expect(orphan?.drifted).toBe(true);
    });

    it("does not resurrect archived orphans", () => {
        const result = build({
            plannedOccurrences: [planned()],
            scheduleEvents: [
                actualDoc(),
                actualDoc({
                    id: "sched-2",
                    ganttOccurrenceDate: "2024-01-20",
                    archived: true,
                }),
            ],
        });
        expect(result.occurrences).toHaveLength(1);
    });
});

describe("buildEventExecution — totals & ordering", () => {
    it("computes totals over a recurring event with mixed outcomes", () => {
        const plannedOccurrences = ["2024-01-07", "2024-01-08", "2024-01-09"].map(
            (date) =>
                planned({
                    occurrenceDate: date,
                    startTime: new Date(`${date}T08:00:00`),
                    endTime: new Date(`${date}T09:00:00`),
                }),
        );
        const result = build({
            plannedOccurrences,
            scheduleEvents: [
                // kept as planned
                actualDoc({ ganttOccurrenceDate: "2024-01-07" }),
                // extended to 2h
                actualDoc({
                    id: "sched-2",
                    ganttOccurrenceDate: "2024-01-08",
                    startTime: new Date("2024-01-08T08:00:00"),
                    endTime: new Date("2024-01-08T10:00:00"),
                }),
                // third deleted
                actualDoc({
                    id: "sched-3",
                    ganttOccurrenceDate: "2024-01-09",
                    archived: true,
                }),
            ],
        });

        expect(result.totals).toEqual({
            plannedMinutes: 180,
            actualMinutes: 60 + 120,
            occurrencesPlanned: 3,
            occurrencesActual: 2,
        });
        expect(result.drifted).toBe(true);
    });

    it("sorts occurrences by date regardless of input order", () => {
        const result = build({
            plannedOccurrences: [
                planned({ occurrenceDate: "2024-01-09" }),
                planned({ occurrenceDate: "2024-01-07" }),
                planned({ occurrenceDate: "2024-01-08" }),
            ],
        });
        expect(result.occurrences.map((o) => o.occurrenceDate)).toEqual([
            "2024-01-07",
            "2024-01-08",
            "2024-01-09",
        ]);
    });

    it("returns an all-clear execution for an event with no drift anywhere", () => {
        const dates = ["2024-01-07", "2024-01-08"];
        const result = build({
            plannedOccurrences: dates.map((date) =>
                planned({
                    occurrenceDate: date,
                    startTime: new Date(`${date}T08:00:00`),
                    endTime: new Date(`${date}T09:00:00`),
                }),
            ),
            scheduleEvents: dates.map((date, i) =>
                actualDoc({
                    id: `sched-${i}`,
                    ganttOccurrenceDate: date,
                    startTime: new Date(`${date}T08:00:00`),
                    endTime: new Date(`${date}T09:00:00`),
                }),
            ),
        });
        expect(result.drifted).toBe(false);
        expect(result.occurrences.every((o) => !o.drifted)).toBe(true);
    });
});
