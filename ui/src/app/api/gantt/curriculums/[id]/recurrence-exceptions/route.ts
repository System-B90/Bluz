export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";

import { ApiSuccess, catchHandler } from "@/api-server/common";
import { listRecurrenceExceptionsForCurriculum } from "@/api-server/gantt/db-recurrence-exceptions";
import { ClientApiError } from "@/api-shared/errors";

type RouteContext = {
    params: Promise<{ id: string }>;
};

/**
 * GET: Fetches every recurrence exception for a curriculum.
 */
export async function GET(request: NextRequest, context: RouteContext) {
    try {
        const { id: curriculumId } = await context.params;
        if (!curriculumId) throw new ClientApiError("Curriculum ID is missing.");

        const exceptions =
            await listRecurrenceExceptionsForCurriculum(curriculumId);
        return ApiSuccess(exceptions);
    } catch (error) {
        return catchHandler(request, error);
    }
}
