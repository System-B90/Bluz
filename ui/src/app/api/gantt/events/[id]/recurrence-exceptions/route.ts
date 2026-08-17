export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";

import { ApiSuccess, withApi } from "@/api-server/common";
import {
    createRecurrenceException,
    deleteRecurrenceException,
} from "@/api-server/gantt/db-recurrence-exceptions";
import { requireStaffSession } from "@/api-server/session-user";
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
    await requireStaffSession();
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

/**
 * DELETE: Restores a skipped occurrence — the event echoes onto that day
 * again (#469). A materialized occurrence is not restorable: its standalone
 * event still occupies the day, so the caller gets a 400 rather than a
 * silently duplicated block.
 */
export const DELETE = withApi(
    async (request: NextRequest, context: RouteContext) => {
        await requireStaffSession();
        const { id: eventId } = await context.params;
        const { curriculumId, dayId } = (await request.json()) as {
            curriculumId: GanttCurriculumId;
            dayId: GanttDayId;
        };
        if (!curriculumId || !dayId) {
            throw new ClientApiError(
                "Missing required fields: curriculumId or dayId.",
            );
        }

        const restored = await deleteRecurrenceException({
            curriculumId,
            eventId,
            dayId,
        });
        if (!restored) {
            throw new ClientApiError(
                "No skipped occurrence to restore for this day.",
            );
        }

        return ApiSuccess({ curriculumId, eventId, dayId });
    },
);
