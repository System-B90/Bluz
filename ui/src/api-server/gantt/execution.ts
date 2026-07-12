import { DbIterations } from "@/api-server/db-iterations";
import { DbSettings } from "@/api-server/db-settings";
import {
    buildCutPlanInput,
    CutExceptionRow,
    CutMappingRow,
    indexCurriculumEvents,
} from "@/api-server/gantt/cut";
import { DbCurriculum } from "@/api-server/gantt/db-curriculum";
import { getModuleDayMappingsForCurriculum } from "@/api-server/gantt/db-mappings";
import { listRecurrenceExceptionsForCurriculum } from "@/api-server/gantt/db-recurrence-exceptions";
import { getDatabaseController } from "@/api-server/mongo-db-controller";
import { planCut, PlannedOccurrence } from "@/api-shared/gantt/cut-planner";
import { DbEventDocument } from "@/api-shared/types/event";
import {
    ApiCurriculumExecutionResponse,
    GanttEventExecution,
    OccurrenceExecution,
} from "@/api-shared/types/gantt/execution";
import { GanttCurriculumId } from "@/api-shared/types/gantt/models";
import {
    DEFAULT_DAY_START_TIME,
    SCHEDULE_SETTINGS_KEY,
    ScheduleSettings,
} from "@/api-shared/types/settings/schedule";

/**
 * תכנון מול ביצוע (#120): recompute the curriculum's cut plan and join it
 * against the schedule events that were generated from it, on
 * `(ganttEventId, ganttOccurrenceDate)`. Read-only; archived events count as
 * "planned but deleted" (actual: null).
 */

const MINUTE_MS = 60_000;

function minutesBetween(start: Date, end: Date): number {
    return Math.round((end.getTime() - start.getTime()) / MINUTE_MS);
}

function sameInstructorSets(a: Array<number>, b: Array<number>): boolean {
    if (a.length !== b.length) return false;
    const set = new Set(a);
    return b.every((id) => set.has(id));
}

function toActual(event: DbEventDocument) {
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
    ganttEventId: string;
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
        const plannedSide = {
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
            !sameInstructorSets(actual.instructorIds, plannedSide.instructorIds);
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

/**
 * Compute the plan-vs-execution comparison for a curriculum. Returns
 * `{ events: {} }` when there is no linked iteration or the curriculum was
 * never cut.
 */
export async function getCurriculumExecution(
    curriculumId: GanttCurriculumId,
): Promise<ApiCurriculumExecutionResponse> {
    const iteration = await DbIterations.getByCurriculum(curriculumId);
    if (!iteration) return { events: {} };

    const controller = getDatabaseController(iteration.dbName);

    // Include archived events: a deleted cut event still counts as planned,
    // rendered as actual: null (bypasses db-event's NOT_ARCHIVED filter).
    const cutEvents = await controller.events
        .find({ ganttEventId: { $exists: true } })
        .toArray();
    if (cutEvents.length === 0) return { events: {} };

    const [curriculum, mappings, exceptions, scheduleSetting] =
        await Promise.all([
            DbCurriculum.getItem(curriculumId),
            getModuleDayMappingsForCurriculum(curriculumId, {}),
            listRecurrenceExceptionsForCurriculum(curriculumId),
            DbSettings.get(SCHEDULE_SETTINGS_KEY, undefined, controller),
        ]);
    const dayStartTime =
        (scheduleSetting as null | ScheduleSettings)?.dayStartTime ??
        DEFAULT_DAY_START_TIME;

    const planInput = buildCutPlanInput({
        curriculum,
        mappings: mappings as Array<CutMappingRow>,
        exceptions: exceptions as Array<CutExceptionRow>,
        dayStartTime,
    });
    const plan = planCut(planInput);
    const plannedOccurrences = plan.ok ? plan.occurrences : [];

    const { eventsById } = indexCurriculumEvents(curriculum);

    const plannedByEvent = new Map<string, Array<PlannedOccurrence>>();
    for (const occurrence of plannedOccurrences) {
        const arr = plannedByEvent.get(occurrence.ganttEventId) ?? [];
        arr.push(occurrence);
        plannedByEvent.set(occurrence.ganttEventId, arr);
    }

    const actualByEvent = new Map<string, Array<DbEventDocument>>();
    for (const event of cutEvents) {
        const key = event.ganttEventId ?? "";
        const arr = actualByEvent.get(key) ?? [];
        arr.push(event);
        actualByEvent.set(key, arr);
    }

    // Only gantt events that were actually cut appear in the response; a
    // planned-but-never-cut event is indistinguishable from "not cut yet".
    const events: Record<string, GanttEventExecution> = {};
    for (const [ganttEventId, scheduleEvents] of actualByEvent) {
        const ganttEvent = eventsById.get(ganttEventId);
        events[ganttEventId] = buildEventExecution({
            ganttEventId,
            plannedOccurrences: plannedByEvent.get(ganttEventId) ?? [],
            plannedInstructorIds:
                ganttEvent?.orchestratorId != null
                    ? [ganttEvent.orchestratorId]
                    : [],
            scheduleEvents,
        });
    }

    return { events };
}
