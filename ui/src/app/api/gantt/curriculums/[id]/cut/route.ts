export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";

import { ApiErrorMaker, ApiSuccess, catchHandler } from "@/api-server/common";
import { cutCurriculumToSchedule } from "@/api-server/gantt/cut";
import { ClientApiError } from "@/api-shared/errors";
import { CurriculumCutErrorCode } from "@/api-shared/types/gantt/cut";
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

/**
 * POST: materialize a published, linked curriculum into schedule events in the
 * linked iteration's database. All inputs are derived server-side from the id.
 */
export async function POST(request: NextRequest, context: RouteContext) {
    try {
        const { id } = await context.params;
        if (!id) throw new ClientApiError("Curriculum ID is missing.");

        const outcome = await cutCurriculumToSchedule(id as GanttCurriculumId);
        if (!outcome.ok) {
            return ApiErrorMaker(
                outcome.error,
                STATUS_BY_CODE[outcome.error.code] ?? 400,
            );
        }

        return ApiSuccess(outcome.result);
    } catch (error) {
        return catchHandler(request, error);
    }
}
