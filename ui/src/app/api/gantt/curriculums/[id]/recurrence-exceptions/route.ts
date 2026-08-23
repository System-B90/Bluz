export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";

import { ApiSuccess, withApi } from "@/api-server/common";
import { listRecurrenceExceptionsForCurriculum } from "@/api-server/gantt/db-recurrence-exceptions";
import { requireStaffSession } from "@/api-server/session-user";
import { ClientApiError } from "@/api-shared/errors";

type RouteContext = {
    params: Promise<{ id: string }>;
};

/**
 * GET: Fetches every recurrence exception for a curriculum.
 */
export const GET = withApi(async (request: NextRequest, context: RouteContext) => {
    await requireStaffSession();
    const { id: curriculumId } = await context.params;
    if (!curriculumId) throw new ClientApiError("Curriculum ID is missing.");

    const exceptions =
        await listRecurrenceExceptionsForCurriculum(curriculumId);
    return ApiSuccess(exceptions);
});
