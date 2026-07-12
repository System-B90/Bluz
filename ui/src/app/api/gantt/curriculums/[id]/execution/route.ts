export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";

import { ApiSuccess, catchHandler } from "@/api-server/common";
import { getCurriculumExecution } from "@/api-server/gantt/execution";
import { ClientApiError } from "@/api-shared/errors";
import { GanttCurriculumId } from "@/api-shared/types/gantt/models";

type RouteContext = {
    params: Promise<{ id: string }>;
};

/**
 * GET: תכנון מול ביצוע — computed-on-read comparison between the curriculum's
 * gantt plan and the schedule events cut from it. Not-yet-cut curriculums
 * (or ones with no linked iteration) return `{ events: {} }` with a 200.
 */
export async function GET(request: NextRequest, context: RouteContext) {
    try {
        const { id } = await context.params;
        if (!id) throw new ClientApiError("Curriculum ID is missing.");

        const execution = await getCurriculumExecution(
            id as GanttCurriculumId,
        );
        return ApiSuccess(execution);
    } catch (error) {
        return catchHandler(request, error);
    }
}
