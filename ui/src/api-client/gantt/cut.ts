import { safeApiFetcher } from "@/api-client/common";
import { ClientApiError } from "@/api-shared/errors";
import {
    ApiCurriculumCutPayload,
    ApiCurriculumCutPlanResponse,
    ApiCurriculumCutPreviewResponse,
    ApiCurriculumCutResponse,
    ApiCurriculumCutStatus,
    ApiCurriculumPullBackResponse,
    CurriculumCutError,
    CurriculumPullBackError,
    isCurriculumCutErrorPayload,
    isCurriculumPullBackErrorPayload,
} from "@/api-shared/types/gantt/cut";
import { GanttCurriculumId } from "@/api-shared/types/gantt/models";
import {
    ApiCurriculumReloadPayload,
    ApiCurriculumReloadResponse,
    CurriculumReloadError,
    isCurriculumReloadErrorPayload,
} from "@/api-shared/types/gantt/reload";

/**
 * POST /api/gantt/curriculums/[id]/cut — materialize a published, linked
 * curriculum into schedule events. Resolves to the cut summary, or throws a
 * {@link CurriculumCutError} carrying the coded reason on a 4xx.
 */
export async function cutCurriculumToSchedule(
    curriculumId: GanttCurriculumId,
    options: ApiCurriculumCutPayload = {},
): Promise<ApiCurriculumCutResponse> {
    try {
        return await safeApiFetcher<ApiCurriculumCutResponse>(
            `/api/gantt/curriculums/${encodeURIComponent(curriculumId)}/cut`,
            { method: "POST", body: JSON.stringify(options) },
        );
    } catch (error) {
        if (error instanceof ClientApiError && isCurriculumCutErrorPayload(error)) {
            throw new CurriculumCutError(error);
        }
        throw error;
    }
}

/**
 * POST /api/gantt/curriculums/[id]/cut/plan — the "plan" half of the
 * plan-then-confirm flow. Runs the full cut pipeline without writing and
 * returns what it would do plus the open decisions the dialog must ask about.
 */
export async function planCurriculumCut(
    curriculumId: GanttCurriculumId,
    options: ApiCurriculumCutPayload = {},
): Promise<ApiCurriculumCutPlanResponse> {
    try {
        return await safeApiFetcher<ApiCurriculumCutPlanResponse>(
            `/api/gantt/curriculums/${encodeURIComponent(curriculumId)}/cut/plan`,
            { method: "POST", body: JSON.stringify(options) },
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
        `/api/gantt/curriculums/${encodeURIComponent(curriculumId)}/cut`,
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
            `/api/gantt/curriculums/${encodeURIComponent(curriculumId)}/cut`,
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

/**
 * GET /api/gantt/curriculums/[id]/cut/preview — dry-run of the cut planner:
 * dated, timed occurrences (or the planner's validation errors), no writes.
 */
export async function previewCurriculumCut(
    curriculumId: GanttCurriculumId,
): Promise<ApiCurriculumCutPreviewResponse> {
    return await safeApiFetcher<ApiCurriculumCutPreviewResponse>(
        `/api/gantt/curriculums/${encodeURIComponent(curriculumId)}/cut/preview`,
    );
}

/**
 * PATCH /api/gantt/curriculums/[id]/cut — reload an already-cut schedule from
 * the current gantt. With `dryRun` the server only computes the diff.
 * @param curriculumId Curriculum to reload from.
 * @param options.dryRun Preview only, nothing is written.
 * @param options.overrideEventIds Manually-edited events to overwrite anyway.
 * @param options.force Plan around unmapped / unsatisfied-recurrence events.
 */
export async function reloadCurriculumSchedule(
    curriculumId: GanttCurriculumId,
    options: ApiCurriculumReloadPayload = {},
): Promise<ApiCurriculumReloadResponse> {
    try {
        return await safeApiFetcher<ApiCurriculumReloadResponse>(
            `/api/gantt/curriculums/${encodeURIComponent(curriculumId)}/cut`,
            { method: "PATCH", body: JSON.stringify(options) },
        );
    } catch (error) {
        if (
            error instanceof ClientApiError &&
            isCurriculumReloadErrorPayload(error)
        ) {
            throw new CurriculumReloadError(error);
        }
        throw error;
    }
}

export const curriculumCutApi = {
    cut: cutCurriculumToSchedule,
    plan: planCurriculumCut,
    reload: reloadCurriculumSchedule,
    status: getCurriculumCutStatus,
    pullBack: pullBackCurriculumSchedule,
    preview: previewCurriculumCut,
} as const;
