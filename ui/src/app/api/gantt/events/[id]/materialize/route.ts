export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";

import { ApiSuccess, catchHandler } from "@/api-server/common";
import { materializeRecurrenceOccurrence } from "@/api-server/gantt/db-recurrence-exceptions";
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
export async function POST(request: NextRequest, context: RouteContext) {
    try {
        const { id: eventId } = await context.params;
        const body = await request.json();

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
    } catch (error) {
        return catchHandler(request, error);
    }
}
