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
        `/api/gantt/curriculums/${curriculumId}/execution`,
    );
}

export const curriculumExecutionApi = {
    get: fetchCurriculumExecution,
} as const;
