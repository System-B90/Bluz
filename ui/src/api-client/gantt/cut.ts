import { safeApiFetcher } from "@/api-client/common";
import { ClientApiError } from "@/api-shared/errors";
import {
    ApiCurriculumCutResponse,
    CurriculumCutError,
    isCurriculumCutErrorPayload,
} from "@/api-shared/types/gantt/cut";
import { GanttCurriculumId } from "@/api-shared/types/gantt/models";

/**
 * POST /api/gantt/curriculums/[id]/cut — materialize a published, linked
 * curriculum into schedule events. Resolves to the cut summary, or throws a
 * {@link CurriculumCutError} carrying the coded reason on a 4xx.
 */
export async function cutCurriculumToSchedule(
    curriculumId: GanttCurriculumId,
): Promise<ApiCurriculumCutResponse> {
    try {
        return await safeApiFetcher<ApiCurriculumCutResponse>(
            `/api/gantt/curriculums/${curriculumId}/cut`,
            { method: "POST" },
        );
    } catch (error) {
        if (error instanceof ClientApiError && isCurriculumCutErrorPayload(error)) {
            throw new CurriculumCutError(error);
        }
        throw error;
    }
}

export const curriculumCutApi = {
    cut: cutCurriculumToSchedule,
} as const;
