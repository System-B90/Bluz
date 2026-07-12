/**
 * API contract for the תכנון מול ביצוע read endpoint (#120): a computed-on-read
 * comparison between a curriculum's gantt plan and the schedule events that were
 * cut from it. No write-back and no snapshot tables — the server recomputes the
 * plan and joins it against the iteration's events on
 * `(ganttEventId, ganttOccurrenceDate)`.
 */

/** Planned side of an occurrence: what the gantt says should happen. */
export type PlannedOccurrenceExecution = {
    /** ISO datetime of the planned start. */
    startTime: string;
    /** ISO datetime of the planned end. */
    endTime: string;
    durationMinutes: number;
    instructorIds: Array<number>;
};

/** Actual side of an occurrence: the schedule event as it exists today. */
export type ActualOccurrenceExecution = {
    eventId: string;
    /** ISO datetime of the actual start. */
    startTime: string;
    /** ISO datetime of the actual end. */
    endTime: string;
    durationMinutes: number;
    instructorIds: Array<number>;
    name: string;
};

export type OccurrenceExecution = {
    /** Planned occurrence date (yyyy-MM-dd) — the join key with the schedule. */
    occurrenceDate: string;
    /**
     * Planned attributes; null for orphaned actual events whose planned
     * occurrence no longer exists in the current plan (gantt edited post-cut).
     */
    planned: null | PlannedOccurrenceExecution;
    /** null ⇒ the generated schedule event was deleted/archived. */
    actual: ActualOccurrenceExecution | null;
    /** Convenience flag: actual missing or any compared field differs. */
    drifted: boolean;
};

export type GanttEventExecution = {
    ganttEventId: string;
    occurrences: Array<OccurrenceExecution>;
    /** Aggregates, mainly useful for recurring events. */
    totals: {
        plannedMinutes: number;
        actualMinutes: number;
        occurrencesPlanned: number;
        occurrencesActual: number;
    };
    /** True when any occurrence drifted. */
    drifted: boolean;
};

export type ApiCurriculumExecutionResponse = {
    /**
     * Keyed by gantt event id. Only gantt events that were cut appear here;
     * empty object ⇒ curriculum not cut yet (or no linked iteration).
     */
    events: Record<string, GanttEventExecution>;
};
