import { describe, expect, it } from "vitest";

import { GanttEventRecurrenceException } from "@/api-shared/types/gantt/models";
import { ganttRecurrenceExceptionReducer } from "@/components/gantt/state/recurrence-exceptions/reducer";
import {
    GanttRecurrenceExceptionState,
    getRecurrenceExceptionKey,
} from "@/components/gantt/state/recurrence-exceptions/types";

/**
 * #469: a skipped recurring occurrence used to vanish from the timeline with
 * no trace and no way back. It is now surfaced as a restorable ghost, so the
 * client state has to be able to drop an exception again — and has to keep
 * materialized occurrences (which own a real standalone event) distinct from
 * merely skipped ones.
 */

const exception = (
    overrides: Partial<GanttEventRecurrenceException> = {},
): GanttEventRecurrenceException => ({
    id: "x1",
    curriculumId: "c1" as GanttEventRecurrenceException["curriculumId"],
    eventId: "e1" as GanttEventRecurrenceException["eventId"],
    dayId: "d3" as GanttEventRecurrenceException["dayId"],
    ...overrides,
});

function stateWith(
    ...exceptions: Array<GanttEventRecurrenceException>
): GanttRecurrenceExceptionState {
    return {
        exceptions: Object.fromEntries(
            exceptions.map((e) => [getRecurrenceExceptionKey(e), e]),
        ),
        isLoading: false,
    };
}

describe("recurrence exception reducer (#469)", () => {
    it("removes a restored occurrence", () => {
        const next = ganttRecurrenceExceptionReducer(
            stateWith(exception()),
            { type: "REMOVE_EXCEPTION", payload: { eventId: "e1", dayId: "d3" } as never },
        );

        expect(Object.keys(next.exceptions)).toHaveLength(0);
    });

    it("leaves other events' exceptions alone", () => {
        const other = exception({ id: "x2", eventId: "e2" as never });
        const next = ganttRecurrenceExceptionReducer(
            stateWith(exception(), other),
            { type: "REMOVE_EXCEPTION", payload: { eventId: "e1", dayId: "d3" } as never },
        );

        expect(Object.keys(next.exceptions)).toEqual([
            getRecurrenceExceptionKey(other),
        ]);
    });

    it("is a no-op — same object — for an unknown occurrence", () => {
        const state = stateWith(exception());
        const next = ganttRecurrenceExceptionReducer(state, {
            type: "REMOVE_EXCEPTION",
            payload: { eventId: "e1", dayId: "d9" } as never,
        });

        expect(next).toBe(state);
    });

    it("round-trips a skip and a restore", () => {
        const empty = stateWith();
        const skipped = ganttRecurrenceExceptionReducer(empty, {
            type: "UPSERT_EXCEPTION",
            payload: exception(),
        });
        expect(Object.keys(skipped.exceptions)).toHaveLength(1);

        const restored = ganttRecurrenceExceptionReducer(skipped, {
            type: "REMOVE_EXCEPTION",
            payload: { eventId: "e1", dayId: "d3" } as never,
        });
        expect(Object.keys(restored.exceptions)).toHaveLength(0);
    });
});

describe("skipped vs materialized occurrences (#469)", () => {
    // The row shape is what the timeline uses to decide which exceptions get a
    // restorable ghost: only those with no materialized event behind them.
    const isRestorable = (e: GanttEventRecurrenceException) =>
        !e.materializedEventId;

    it("treats a plain exception as skipped, hence restorable", () => {
        expect(isRestorable(exception())).toBe(true);
        expect(isRestorable(exception({ materializedEventId: null }))).toBe(true);
    });

    it("does not offer to restore a materialized occurrence", () => {
        // Restoring would echo the source event onto a day that already holds
        // the standalone copy.
        expect(
            isRestorable(exception({ materializedEventId: "e_new" as never })),
        ).toBe(false);
    });
});
