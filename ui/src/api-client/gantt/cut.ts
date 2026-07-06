import { safeFetcher } from "@/api-client/common";
import { ClientApiError } from "@/api-shared/errors";
import {
    ApiCurriculumCutError,
    ApiCurriculumCutResponse,
} from "@/api-shared/types/gantt/cut";
import { GanttCurriculumId } from "@/api-shared/types/gantt/models";

/**
 * Typed wrapper for a rejected cut. Carries the structured
 * {@link ApiCurriculumCutError} (code + planner validation errors + count) so
 * the UI can render a specific message / validation list instead of a generic
 * network error. Extends {@link ClientApiError} so it flows through the shared
 * snackbar handling.
 */
export class CurriculumCutError extends ClientApiError {
    readonly cutError: ApiCurriculumCutError;
    constructor(cutError: ApiCurriculumCutError) {
        super(cutError.message ?? 'גזירת הגאנט ללו"ז נכשלה');
        this.name = "CurriculumCutError";
        this.cutError = cutError;
    }
}

/**
 * POST /api/gantt/curriculums/[id]/cut — materialize a published, linked
 * curriculum into schedule events. Resolves to the cut summary, or throws a
 * {@link CurriculumCutError} carrying the coded reason on a 4xx.
 */
export async function cutCurriculumToSchedule(
    curriculumId: GanttCurriculumId,
): Promise<ApiCurriculumCutResponse> {
    const response = await safeFetcher(
        `/api/gantt/curriculums/${curriculumId}/cut`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
        },
    );

    const body = await response.json().catch(() => null);

    if (response.ok && body?.status === 0) {
        return body.data as ApiCurriculumCutResponse;
    }

    const error = body?.error;
    if (error && typeof error.code === "string") {
        throw new CurriculumCutError(error as ApiCurriculumCutError);
    }
    throw new ClientApiError(
        error?.message ?? `גזירת הגאנט נכשלה (${response.status})`,
    );
}

export const curriculumCutApi = {
    cut: cutCurriculumToSchedule,
} as const;
