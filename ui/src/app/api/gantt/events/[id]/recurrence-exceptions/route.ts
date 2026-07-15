export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";

import { ApiSuccess, withApi } from "@/api-server/common";
import { createRecurrenceException } from "@/api-server/gantt/db-recurrence-exceptions";
import { ClientApiError } from "@/api-shared/errors";
import { GanttCurriculumId, GanttDayId } from "@/api-shared/types/gantt/models";

type RouteContext = {
    params: Promise<{ id: string }>;
};

/**
 * POST: Deletes a single recurring occurrence (the event keeps recurring
 * everywhere else — only this day is excepted).
 */
export const POST = withApi(async (request: NextRequest, context: RouteContext) => {
    const { id: eventId } = await context.params;
    const body = await request.json();

    const { curriculumId, dayId } = body as {
        curriculumId: GanttCurriculumId;
        dayId: GanttDayId;
    };
    if (!curriculumId || !dayId) {
        throw new ClientApiError(
            "Missing required fields: curriculumId or dayId.",
        );
    }

    const exception = await createRecurrenceException({
        curriculumId,
        eventId,
        dayId,
    });

    return ApiSuccess(exception);
});
