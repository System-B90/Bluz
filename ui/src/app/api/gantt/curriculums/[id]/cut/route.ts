export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";

import { ApiErrorMaker, ApiSuccess, withApi } from "@/api-server/common";
import {
    cutCurriculumToSchedule,
    getCutStatus,
    pullBackCutSchedule,
} from "@/api-server/gantt/cut";
import { ClientApiError } from "@/api-shared/errors";
import {
    CurriculumCutErrorCode,
    CurriculumPullBackErrorCode,
} from "@/api-shared/types/gantt/cut";
import { GanttCurriculumId } from "@/api-shared/types/gantt/models";

type RouteContext = {
    params: Promise<{ id: string }>;
};

// Coded gating failures map to a 4xx that nothing was written for. State
// conflicts (draft / unlinked / already-cut) are 409; an invalid plan is a 400.
const STATUS_BY_CODE: Record<CurriculumCutErrorCode, number> = {
    draft: 409,
    "no-iteration": 409,
    "already-cut": 409,
    "invalid-plan": 400,
};

// Pull-back conflicts (no linked iteration / nothing cut) are 409.
const PULL_BACK_STATUS_BY_CODE: Record<CurriculumPullBackErrorCode, number> = {
    "no-iteration": 409,
    "not-cut": 409,
};

/**
 * POST: materialize a published, linked curriculum into schedule events in the
 * linked iteration's database. All inputs are derived server-side from the id.
 */
export const POST = withApi(async (request: NextRequest, context: RouteContext) => {
    const { id } = await context.params;
    if (!id) throw new ClientApiError("Curriculum ID is missing.");

    const body = await request.json().catch(() => null);
    const force = Boolean((body as null | { force?: boolean })?.force);

    const outcome = await cutCurriculumToSchedule(id as GanttCurriculumId, force);
    if (!outcome.ok) {
        return ApiErrorMaker(
            outcome.error,
            STATUS_BY_CODE[outcome.error.code] ?? 400,
        );
    }

    return ApiSuccess(outcome.result);
});

/**
 * GET: cut status for a curriculum — whether its linked iteration currently
 * holds live cut events, driving the UI toggle between "cut" and "pull back".
 */
export const GET = withApi(async (request: NextRequest, context: RouteContext) => {
    const { id } = await context.params;
    if (!id) throw new ClientApiError("Curriculum ID is missing.");

    return ApiSuccess(await getCutStatus(id as GanttCurriculumId));
});

/**
 * DELETE: pull back a previous cut — soft-delete every live schedule event that
 * was generated for this curriculum in the linked iteration.
 */
export const DELETE = withApi(async (request: NextRequest, context: RouteContext) => {
    const { id } = await context.params;
    if (!id) throw new ClientApiError("Curriculum ID is missing.");

    const outcome = await pullBackCutSchedule(id as GanttCurriculumId);
    if (!outcome.ok) {
        return ApiErrorMaker(
            outcome.error,
            PULL_BACK_STATUS_BY_CODE[outcome.error.code] ?? 400,
        );
    }

    return ApiSuccess(outcome.result);
});
