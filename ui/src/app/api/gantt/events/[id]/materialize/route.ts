export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";

import {
    ApiSuccess,
    requireJsonObjectBody,
    withApi,
} from "@/api-server/common";
import { materializeRecurrenceOccurrence } from "@/api-server/gantt/db-recurrence-exceptions";
import { requireStaffSession } from "@/api-server/session-user";
import { ClientApiError } from "@/api-shared/errors";
import {
    GanttCurriculumId,
    GanttDayId,
    GanttModuleId,
} from "@/api-shared/types/gantt/models";

type RouteContext = {
    params: Promise<{ id: string }>;
};

/**
 * POST: Materializes a recurring occurrence into its own standalone event,
 * mapped onto the occurrence day, and excepts the source event from
 * echoing onto that day going forward.
 */
export const POST = withApi(async (request: NextRequest, context: RouteContext) => {
    await requireStaffSession();
    const { id: eventId } = await context.params;
    const body = await requireJsonObjectBody<Record<string, unknown>>(request);

    const { curriculumId, moduleId, dayId } = body as {
        curriculumId: GanttCurriculumId;
        moduleId: GanttModuleId;
        dayId: GanttDayId;
    };
    if (!curriculumId || !moduleId || !dayId) {
        throw new ClientApiError(
            "Missing required fields: curriculumId, moduleId or dayId.",
        );
    }

    const result = await materializeRecurrenceOccurrence({
        curriculumId,
        moduleId,
        eventId,
        dayId,
    });

    return ApiSuccess(result);
});
