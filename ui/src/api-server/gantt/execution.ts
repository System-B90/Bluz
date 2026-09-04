import { DbIterations } from "@/api-server/db-iterations";
import { DbSettings } from "@/api-server/db-settings";
import {
    buildCutPlanInput,
    CutConstraintRow,
    CutExceptionRow,
    CutMappingRow,
    indexCurriculumEvents,
    prayerWindowsFromSettings,
    toGanttConstraints,
} from "@/api-server/gantt/cut";
import { getConstraintsForCurriculum } from "@/api-server/gantt/db-constraints";
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
import { MEAL_TIMES_SETTING_KEY, MealSettings } from "@/api-shared/types/settings/meal";
import { PRAYER_TIMES_SETTING_KEY, PrayerSettings } from "@/api-shared/types/settings/prayer";
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

    const [
        curriculum,
        mappings,
        exceptions,
        constraints,
        scheduleSetting,
        mealSetting,
        prayerSetting,
    ] = await Promise.all([
        DbCurriculum.getItem(curriculumId),
        getModuleDayMappingsForCurriculum(curriculumId, {}),
        listRecurrenceExceptionsForCurriculum(curriculumId),
        getConstraintsForCurriculum(curriculumId),
        DbSettings.get(SCHEDULE_SETTINGS_KEY, undefined, controller),
        DbSettings.get(MEAL_TIMES_SETTING_KEY, undefined, controller),
        DbSettings.get(PRAYER_TIMES_SETTING_KEY, undefined, controller),
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
        breakfastTime: (mealSetting as MealSettings | null)?.breakfastTime,
        lunchTime: (mealSetting as MealSettings | null)?.lunchTime,
        dinnerTime: (mealSetting as MealSettings | null)?.dinnerTime,
        prayerTimes: prayerWindowsFromSettings(
            prayerSetting as null | PrayerSettings,
        ),
        constraints: toGanttConstraints(constraints as Array<CutConstraintRow>),
    });

    // Tolerant like the preview, unlike the real cut: a single unmapped event
    // or unsatisfied recurrence must not blank out the planned side for
    // every *other* event in the curriculum (#…) — skip just the offending
    // event and re-plan. Only a missing start date is fatal (nothing is
    // datable at all).
    let plan = planCut(planInput);
    if (!plan.ok) {
        const skippedEventIds = new Set(
            plan.errors
                .filter((error) => "eventId" in error)
                .map((error) => error.eventId),
        );
        plan = skippedEventIds.size > 0
            ? planCut({
                ...planInput,
                events: planInput.events.filter(
                    (event) => !skippedEventIds.has(event.id),
                ),
            })
            : plan;
    }
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
