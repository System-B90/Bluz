export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";

import { ApiErrorMaker, ApiSuccess, withApi } from "@/api-server/common";
import { planCurriculumCut } from "@/api-server/gantt/cut";
import { requireStaffSession } from "@/api-server/session-user";
import { ClientApiError } from "@/api-shared/errors";
import {
    ApiCurriculumCutPayload,
    CurriculumCutErrorCode,
} from "@/api-shared/types/gantt/cut";
import { GanttCurriculumId } from "@/api-shared/types/gantt/models";

type RouteContext = {
    params: Promise<{ id: string }>;
};

// Same gating semantics as the commit: state conflicts are 409.
const STATUS_BY_CODE: Partial<Record<CurriculumCutErrorCode, number>> = {
    draft: 409,
    "no-iteration": 409,
};

/**
 * POST: the "plan" half of the plan-then-confirm cut flow. Runs the full
 * pipeline (balance → constraints → breaks) and reports what the commit would
 * do plus the open decisions, without writing anything.
 *
 * The dialog calls this first, walks the returned `report.decisions` one at a
 * time, and then POSTs `../cut` with the user's answers.
 */
export const POST = withApi(
    async (request: NextRequest, context: RouteContext) => {
        await requireStaffSession();
        const { id } = await context.params;
        if (!id) throw new ClientApiError("Curriculum ID is missing.");

        const body = (await request
            .json()
            .catch(() => null)) as ApiCurriculumCutPayload | null;

        const outcome = await planCurriculumCut(id as GanttCurriculumId, {
            force: Boolean(body?.force),
            autoSpillover: body?.autoSpillover ?? true,
            insertBreaks: body?.insertBreaks ?? true,
            acceptedConstraintMoves: body?.acceptedConstraintMoves ?? [],
            weekOverflowResolutions: body?.weekOverflowResolutions ?? {},
        });

        if (!outcome.ok) {
            return ApiErrorMaker(
                outcome.error,
                STATUS_BY_CODE[outcome.error.code] ?? 400,
            );
        }

        return ApiSuccess(outcome.result);
    },
);
