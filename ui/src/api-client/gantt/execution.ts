import { safeApiFetcher } from "@/api-client/common";
import { ApiCurriculumExecutionResponse } from "@/api-shared/types/gantt/execution";
import { GanttCurriculumId } from "@/api-shared/types/gantt/models";

/**
 * GET /api/gantt/curriculums/[id]/execution — תכנון מול ביצוע comparison for a
 * curriculum. Resolves to `{ events: {} }` when the curriculum has not been
 * cut into a schedule yet.
 */
export async function fetchCurriculumExecution(
    curriculumId: GanttCurriculumId,
): Promise<ApiCurriculumExecutionResponse> {
    return await safeApiFetcher<ApiCurriculumExecutionResponse>(
        `/api/gantt/curriculums/${encodeURIComponent(curriculumId)}/execution`,
    );
}

/**
 * POST /api/gantt/curriculums/[id]/execution/recreate — re-create the schedule
 * event for one deleted cut occurrence (#682).
 */
export async function recreateExecutionOccurrence(
    curriculumId: GanttCurriculumId,
    ganttEventId: string,
    occurrenceDate: string,
): Promise<{ createdEvents: number }> {
    return await safeApiFetcher<{ createdEvents: number }>(
        `/api/gantt/curriculums/${encodeURIComponent(curriculumId)}/execution/recreate`,
        {
            method: "POST",
            body: JSON.stringify({ ganttEventId, occurrenceDate }),
        },
    );
}

export const curriculumExecutionApi = {
    get: fetchCurriculumExecution,
    recreateOccurrence: recreateExecutionOccurrence,
} as const;
