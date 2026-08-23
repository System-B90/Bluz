export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";

import { ApiSuccess, withApi } from "@/api-server/common";
import { previewCurriculumCut } from "@/api-server/gantt/cut";
import { requireStaffSession } from "@/api-server/session-user";
import { ClientApiError } from "@/api-shared/errors";
import { GanttCurriculumId } from "@/api-shared/types/gantt/models";

type RouteContext = {
    params: Promise<{ id: string }>;
};

/**
 * GET: dry-run cut preview — the planner's dated, timed occurrences for this
 * curriculum, with no gating and no writes. Powers the week-preview and
 * timeframe-events tabs in the curriculum view.
 */
export const GET = withApi(
    async (request: NextRequest, context: RouteContext) => {
        await requireStaffSession();
        const { id } = await context.params;
        if (!id) throw new ClientApiError("Curriculum ID is missing.");

        return ApiSuccess(await previewCurriculumCut(id as GanttCurriculumId));
    },
);
