export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";

import { ApiSuccess, requireJsonObjectBody, withApi } from "@/api-server/common";
import { recreateExecutionOccurrence } from "@/api-server/gantt/cut";
import { requireStaffSession } from "@/api-server/session-user";
import { ClientApiError } from "@/api-shared/errors";
import { GanttCurriculumId } from "@/api-shared/types/gantt/models";

type RouteContext = {
    params: Promise<{ id: string }>;
};
type RecreateOccurrencePayload = {
    ganttEventId: string;
    occurrenceDate: string;
};

/**
 * POST: re-create the schedule event for one deleted cut occurrence (#682),
 * from the "תכנון מול ביצוע" section of the gantt event dialog.
 */
export const POST = withApi(
    async (request: NextRequest, context: RouteContext) => {
        await requireStaffSession();
        const { id } = await context.params;
        if (!id) throw new ClientApiError("Curriculum ID is missing.");

        const payload =
            await requireJsonObjectBody<RecreateOccurrencePayload>(request);
        if (!payload.ganttEventId || !payload.occurrenceDate) {
            throw new ClientApiError(
                "ganttEventId and occurrenceDate are required.",
            );
        }

        const outcome = await recreateExecutionOccurrence(
            id as GanttCurriculumId,
            payload.ganttEventId,
            payload.occurrenceDate,
        );
        if (!outcome.ok) {
            throw new ClientApiError(outcome.error.message);
        }
        return ApiSuccess(outcome.result);
    },
);
