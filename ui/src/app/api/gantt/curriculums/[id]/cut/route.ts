export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";

import { ApiErrorMaker, ApiSuccess, withApi } from "@/api-server/common";
import {
    cutCurriculumToSchedule,
    getCutStatus,
    pullBackCutSchedule,
} from "@/api-server/gantt/cut";
import { reloadCurriculumSchedule } from "@/api-server/gantt/reload";
import { requireStaffSession } from "@/api-server/session-user";
import { ClientApiError } from "@/api-shared/errors";
import {
    ApiCurriculumCutPayload,
    CurriculumCutErrorCode,
    CurriculumPullBackErrorCode,
} from "@/api-shared/types/gantt/cut";
import { GanttCurriculumId } from "@/api-shared/types/gantt/models";
import {
    ApiCurriculumReloadPayload,
    CurriculumReloadErrorCode,
} from "@/api-shared/types/gantt/reload";

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

// Reload state conflicts (draft / unlinked / never cut) are 409; an invalid
// plan is a 400, matching the cut.
const RELOAD_STATUS_BY_CODE: Record<CurriculumReloadErrorCode, number> = {
    draft: 409,
    "invalid-plan": 400,
    "no-iteration": 409,
    "not-cut": 409,
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
export const POST = withApi(
    async (request: NextRequest, context: RouteContext) => {
        await requireStaffSession();
        const { id } = await context.params;
        if (!id) throw new ClientApiError("Curriculum ID is missing.");

        const body = (await request
            .json()
            .catch(() => null)) as ApiCurriculumCutPayload | null;

        // Balancing and breaks default to on; the dialog sends explicit booleans.
        const outcome = await cutCurriculumToSchedule(id as GanttCurriculumId, {
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

/**
 * GET: cut status for a curriculum — whether its linked iteration currently
 * holds live cut events, driving the UI toggle between "cut" and "pull back".
 */
export const GET = withApi(
    async (request: NextRequest, context: RouteContext) => {
        await requireStaffSession();
        const { id } = await context.params;
        if (!id) throw new ClientApiError("Curriculum ID is missing.");

        return ApiSuccess(await getCutStatus(id as GanttCurriculumId));
    },
);

/**
 * PATCH: reload an already-cut schedule from the current gantt — add new
 * occurrences, retime changed ones, archive dropped ones. Manually edited
 * events are skipped and reported as conflicts unless listed in
 * `overrideEventIds`. `dryRun` returns the same diff without writing.
 */
export const PATCH = withApi(
    async (request: NextRequest, context: RouteContext) => {
        await requireStaffSession();
        const { id } = await context.params;
        if (!id) throw new ClientApiError("Curriculum ID is missing.");

        const body = (await request
            .json()
            .catch(() => null)) as ApiCurriculumReloadPayload | null;

        const outcome = await reloadCurriculumSchedule(
            id as GanttCurriculumId,
            {
                dryRun: Boolean(body?.dryRun),
                force: Boolean(body?.force),
                overrideEventIds: body?.overrideEventIds ?? [],
            },
        );
        if (!outcome.ok) {
            return ApiErrorMaker(
                outcome.error,
                RELOAD_STATUS_BY_CODE[outcome.error.code] ?? 400,
            );
        }

        return ApiSuccess(outcome.result);
    },
);

/**
 * DELETE: pull back a previous cut — soft-delete every live schedule event that
 * was generated for this curriculum in the linked iteration.
 */
export const DELETE = withApi(
    async (request: NextRequest, context: RouteContext) => {
        await requireStaffSession();
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
    },
);
