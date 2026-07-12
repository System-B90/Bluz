import { PlannedOccurrence } from "@/api-shared/gantt/cut-planner";
import { DbEventDocument } from "@/api-shared/types/event";
import {
    ActualOccurrenceExecution,
    GanttEventExecution,
    OccurrenceExecution,
    PlannedOccurrenceExecution,
} from "@/api-shared/types/gantt/execution";
import { GanttEventId } from "@/api-shared/types/gantt/models";

/**
 * Pure join logic for תכנון מול ביצוע (#120): matches a gantt event's planned
 * occurrences against the schedule events that were cut from it. No I/O — the
 * server loads the data and calls in here, and the logic stays unit-testable.
 */

const MINUTE_MS = 60_000;

export function minutesBetween(start: Date, end: Date): number {
    return Math.round((end.getTime() - start.getTime()) / MINUTE_MS);
}

export function sameInstructorSets(
    a: Array<number>,
    b: Array<number>,
): boolean {
    if (a.length !== b.length) return false;
    const set = new Set(a);
    return b.every((id) => set.has(id));
}

function toActual(event: DbEventDocument): ActualOccurrenceExecution {
    const startTime = new Date(event.startTime);
    const endTime = new Date(event.endTime);
    return {
        eventId: event.id,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        durationMinutes: minutesBetween(startTime, endTime),
        instructorIds: event.instructors ?? [],
        name: event.name,
    };
}

/** Joins one gantt event's planned occurrences with its cut schedule events. */
export function buildEventExecution(args: {
    ganttEventId: GanttEventId;
    plannedOccurrences: Array<PlannedOccurrence>;
    plannedInstructorIds: Array<number>;
    /** All cut events for this gantt event, including archived ones. */
    scheduleEvents: Array<DbEventDocument>;
}): GanttEventExecution {
    const {
        ganttEventId,
        plannedOccurrences,
        plannedInstructorIds,
        scheduleEvents,
    } = args;

    const liveByDate = new Map<string, DbEventDocument>();
    for (const event of scheduleEvents) {
        if (event.archived) continue;
        liveByDate.set(event.ganttOccurrenceDate ?? "", event);
    }

    const occurrences: Array<OccurrenceExecution> = [];
    const plannedDates = new Set<string>();

    for (const planned of plannedOccurrences) {
        plannedDates.add(planned.occurrenceDate);
        const live = liveByDate.get(planned.occurrenceDate);
        const actual = live ? toActual(live) : null;
        const plannedSide: PlannedOccurrenceExecution = {
            startTime: planned.startTime.toISOString(),
            endTime: planned.endTime.toISOString(),
            durationMinutes: minutesBetween(
                planned.startTime,
                planned.endTime,
            ),
            instructorIds: plannedInstructorIds,
        };
        const drifted =
            !actual ||
            actual.startTime !== plannedSide.startTime ||
            actual.endTime !== plannedSide.endTime ||
            !sameInstructorSets(
                actual.instructorIds,
                plannedSide.instructorIds,
            );
        occurrences.push({
            occurrenceDate: planned.occurrenceDate,
            planned: plannedSide,
            actual,
            drifted,
        });
    }

    // Orphaned actuals: cut events whose planned occurrence no longer exists in
    // the current plan (gantt edited after the cut). Surfaced with planned:
    // null so the UI can render them distinctly; always drifted.
    for (const event of scheduleEvents) {
        if (event.archived) continue;
        const date = event.ganttOccurrenceDate ?? "";
        if (plannedDates.has(date)) continue;
        occurrences.push({
            occurrenceDate: date,
            planned: null,
            actual: toActual(event),
            drifted: true,
        });
    }

    occurrences.sort((a, b) =>
        a.occurrenceDate.localeCompare(b.occurrenceDate),
    );

    const totals = {
        plannedMinutes: occurrences.reduce(
            (sum, occ) => sum + (occ.planned?.durationMinutes ?? 0),
            0,
        ),
        actualMinutes: occurrences.reduce(
            (sum, occ) => sum + (occ.actual?.durationMinutes ?? 0),
            0,
        ),
        occurrencesPlanned: plannedOccurrences.length,
        occurrencesActual: occurrences.filter((occ) => occ.actual).length,
    };

    return {
        ganttEventId,
        occurrences,
        totals,
        drifted: occurrences.some((occ) => occ.drifted),
    };
}
