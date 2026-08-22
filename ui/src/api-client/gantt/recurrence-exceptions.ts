import { ClientApiProps, safeApiFetcher } from "@/api-client/common";
import {
    GanttCurriculumId,
    GanttDayId,
    GanttEvent,
    GanttEventId,
    GanttEventRecurrenceException,
    GanttModuleId,
} from "@/api-shared/types/gantt/models";

/**
 * GET: Retrieves every recurrence exception for a curriculum.
 */
async function apiGetRecurrenceExceptions(
    curriculumId: GanttCurriculumId,
    options?: ClientApiProps,
): Promise<Array<GanttEventRecurrenceException>> {
    return await safeApiFetcher<Array<GanttEventRecurrenceException>>(
        `/api/gantt/curriculums/${encodeURIComponent(curriculumId)}/recurrence-exceptions`,
        { ...options },
    );
}

/**
 * POST: Deletes a single recurring occurrence (excepts that day only).
 */
async function apiDeleteOccurrence(
    eventId: GanttEventId,
    payload: { curriculumId: GanttCurriculumId; dayId: GanttDayId },
    options?: ClientApiProps,
): Promise<GanttEventRecurrenceException> {
    return await safeApiFetcher<GanttEventRecurrenceException>(
        `/api/gantt/events/${encodeURIComponent(eventId)}/recurrence-exceptions`,
        {
            ...options,
            method: "POST",
            body: JSON.stringify(payload),
        },
    );
}

/**
 * POST: Materializes a recurring occurrence into its own standalone event.
 */
async function apiMaterializeOccurrence(
    eventId: GanttEventId,
    payload: {
        curriculumId: GanttCurriculumId;
        moduleId: GanttModuleId;
        dayId: GanttDayId;
    },
    options?: ClientApiProps,
): Promise<{
    event: GanttEvent & { id: GanttEventId };
    mapping: { moduleId: GanttModuleId; eventId: GanttEventId; dayId: GanttDayId };
}> {
    return await safeApiFetcher(
        `/api/gantt/events/${encodeURIComponent(eventId)}/materialize`,
        {
            ...options,
            method: "POST",
            body: JSON.stringify(payload),
        },
    );
}

/**
 * DELETE: Restores a previously skipped occurrence (#469).
 */
async function apiRestoreOccurrence(
    eventId: GanttEventId,
    payload: { curriculumId: GanttCurriculumId; dayId: GanttDayId },
    options?: ClientApiProps,
): Promise<{
    curriculumId: GanttCurriculumId;
    dayId: GanttDayId;
    eventId: GanttEventId;
}> {
    return await safeApiFetcher(
        `/api/gantt/events/${encodeURIComponent(eventId)}/recurrence-exceptions`,
        {
            ...options,
            method: "DELETE",
            body: JSON.stringify(payload),
        },
    );
}

export const recurrenceExceptionApi = {
    apiGet: apiGetRecurrenceExceptions,
    apiDeleteOccurrence,
    apiMaterializeOccurrence,
    apiRestoreOccurrence,
} as const;
