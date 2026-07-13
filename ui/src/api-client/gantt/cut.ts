import { safeApiFetcher } from "@/api-client/common";
import { ClientApiError } from "@/api-shared/errors";
import {
    ApiCurriculumCutResponse,
    ApiCurriculumCutStatus,
    ApiCurriculumPullBackResponse,
    CurriculumCutError,
    CurriculumPullBackError,
    isCurriculumCutErrorPayload,
    isCurriculumPullBackErrorPayload,
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

/**
 * GET /api/gantt/curriculums/[id]/cut — whether the curriculum currently holds
 * live cut events, used to toggle between the "cut" and "pull back" actions.
 */
export async function getCurriculumCutStatus(
    curriculumId: GanttCurriculumId,
): Promise<ApiCurriculumCutStatus> {
    return await safeApiFetcher<ApiCurriculumCutStatus>(
        `/api/gantt/curriculums/${curriculumId}/cut`,
    );
}

/**
 * DELETE /api/gantt/curriculums/[id]/cut — soft-delete every schedule event a
 * previous cut generated. Throws a {@link CurriculumPullBackError} carrying the
 * coded reason on a 4xx.
 */
export async function pullBackCurriculumSchedule(
    curriculumId: GanttCurriculumId,
): Promise<ApiCurriculumPullBackResponse> {
    try {
        return await safeApiFetcher<ApiCurriculumPullBackResponse>(
            `/api/gantt/curriculums/${curriculumId}/cut`,
            { method: "DELETE" },
        );
    } catch (error) {
        if (
            error instanceof ClientApiError &&
            isCurriculumPullBackErrorPayload(error)
        ) {
            throw new CurriculumPullBackError(error);
        }
        throw error;
    }
}

export const curriculumCutApi = {
    cut: cutCurriculumToSchedule,
    status: getCurriculumCutStatus,
    pullBack: pullBackCurriculumSchedule,
} as const;
