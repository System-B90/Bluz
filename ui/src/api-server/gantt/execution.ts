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
import { buildEventExecution } from "@/api-shared/gantt/execution";
import { DbEventDocument } from "@/api-shared/types/event";
import {
    ApiCurriculumExecutionResponse,
    GanttEventExecution,
} from "@/api-shared/types/gantt/execution";
import {
    GanttCurriculumId,
    GanttEventId,
} from "@/api-shared/types/gantt/models";
import {
    DEFAULT_DAY_START_TIME,
    DEFAULT_WEEKEND_HOME_START_TIME,
    SCHEDULE_SETTINGS_KEY,
    ScheduleSettings,
} from "@/api-shared/types/settings/schedule";

/**
 * תכנון מול ביצוע (#120): load the curriculum's plan and its cut schedule
 * events, then delegate the pure join to `api-shared/gantt/execution.ts`.
 * Read-only; archived events count as "planned but deleted" (actual: null).
 */

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
    // Projected down to exactly the fields `buildEventExecution` consumes —
    // full cut-event documents were loaded only to read these (#538 item 8).
    const cutEvents = await controller.events
        .find(
            { ganttEventId: { $exists: true } },
            {
                projection: {
                    id: 1,
                    name: 1,
                    startTime: 1,
                    endTime: 1,
                    instructors: 1,
                    archived: 1,
                    ganttEventId: 1,
                    ganttOccurrenceDate: 1,
                    _id: 0,
                },
            },
        )
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
    const weekendHomeStartTime =
        (scheduleSetting as null | ScheduleSettings)?.weekendHomeStartTime ??
        DEFAULT_WEEKEND_HOME_START_TIME;

    const planInput = buildCutPlanInput({
        curriculum,
        mappings: mappings as Array<CutMappingRow>,
        exceptions: exceptions as Array<CutExceptionRow>,
        dayStartTime,
        weekendHomeStartTime,
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

    const actualByEvent = new Map<GanttEventId, Array<DbEventDocument>>();
    for (const event of cutEvents) {
        const key = (event.ganttEventId ?? "") as GanttEventId;
        const arr = actualByEvent.get(key) ?? [];
        arr.push(event);
        actualByEvent.set(key, arr);
    }

    // Only gantt events that were actually cut appear in the response; a
    // planned-but-never-cut event is indistinguishable from "not cut yet".
    const events: Record<GanttEventId, GanttEventExecution> = {};
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
