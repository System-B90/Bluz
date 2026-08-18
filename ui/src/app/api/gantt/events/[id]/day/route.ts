/**
 * Name: route.ts
 * Purpose: Event-scoped day placement (cMDA) — set or clear which day an
 *          event falls on for a curriculum, without needing to know its
 *          previous day the way the curriculum-scoped mappings route does.
 * Created: 2026-08-18
 * Author: Michael K. Steinberg
 */

import { NextRequest } from "next/server";

import { ApiSuccess, withApi } from "@/api-server/common";
import { setEventDayMapping, unsetEventDayMapping } from "@/api-server/gantt/db-mappings";
import { requireStaffSession } from "@/api-server/session-user";
import { ClientApiError } from "@/api-shared/errors";
import { GanttCurriculumId, GanttDayId, GanttModuleId } from "@/api-shared/types/gantt/models";

export type RouteContext = {
    params: Promise<{ id: string }>;
};

/**
 * POST: Places (or moves) the event onto a day for a curriculum.
 */
export const POST = withApi(async (request: NextRequest, context: RouteContext) => {
    await requireStaffSession();
    const { id: eventId } = await context.params;
    if (!eventId) throw new ClientApiError("Event ID is missing.");

    const body = await request.json();
    const { curriculumId, moduleId, dayId, sortOrder } = body as {
        curriculumId: GanttCurriculumId;
        moduleId: GanttModuleId;
        dayId: GanttDayId;
        sortOrder?: number;
    };
    if (!curriculumId || !moduleId || !dayId) {
        throw new ClientApiError(
            "Missing required fields: curriculumId, moduleId or dayId.",
        );
    }

    const mapping = await setEventDayMapping(
        curriculumId,
        moduleId,
        eventId,
        dayId,
        sortOrder,
    );
    return ApiSuccess(mapping);
});

/**
 * DELETE: Clears the event's day placement for a curriculum.
 */
export const DELETE = withApi(async (request: NextRequest, context: RouteContext) => {
    await requireStaffSession();
    const { id: eventId } = await context.params;
    if (!eventId) throw new ClientApiError("Event ID is missing.");

    const body = await request.json();
    const { curriculumId, moduleId } = body as {
        curriculumId: GanttCurriculumId;
        moduleId: GanttModuleId;
    };
    if (!curriculumId || !moduleId) {
        throw new ClientApiError("Missing required fields: curriculumId or moduleId.");
    }

    const deleted = await unsetEventDayMapping(curriculumId, moduleId, eventId);
    return ApiSuccess(deleted);
});
