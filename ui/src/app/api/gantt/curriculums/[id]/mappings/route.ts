/**
 * Name: route.ts
 * Purpose: Route handlers for curriculum module assignments (cMDA).
 * Created: 2026-04-15
 * Author: Michael K. Steinberg
 */

import { NextRequest } from "next/server";

import {
    ApiSuccess,
    requireJsonObjectBody,
    withApi,
} from "@/api-server/common";
import {
    createCurriculumModuleDayMapping,
    deleteCurriculumModuleDayMapping,
    getModuleDayMappingsForCurriculum,
    updateCurriculumModuleDayMapping,
} from "@/api-server/gantt/db-mappings";
import { requireStaffSession } from "@/api-server/session-user";
import { ClientApiError } from "@/api-shared/errors";
import { CreateGanttCurriculumEventDayMapping } from "@/api-shared/types/gantt/create-payloads";
import {
    GanttDayId,
    GanttEventId,
    GanttModuleId,
} from "@/api-shared/types/gantt/models";

export type RouteContext = {
    params: Promise<{ id: string }>;
};

/**
 * GET: Fetches assignments for a curriculum.
 */
export const GET = withApi(
    async (request: NextRequest, context: RouteContext) => {
        await requireStaffSession();
        const { id } = await context.params;
        if (!id) throw new ClientApiError("Curriculum ID is missing.");

        // `getAll` yields [] when the caller passed no `dayId` at all, which means
        // "every day", not "no days" — only forward it as a filter when present.
        const dayIds = request.nextUrl.searchParams.getAll("dayId");

        const mappings = await getModuleDayMappingsForCurriculum(id, {
            dayIds: dayIds.length > 0 ? dayIds : undefined,
        });
        return ApiSuccess(mappings);
    },
);

/**
 * POST: Creates a new module-to-day mapping.
 */
export const POST = withApi(
    async (request: NextRequest, context: RouteContext) => {
        await requireStaffSession();
        const { id: curriculumId } = await context.params;
        const body =
            await requireJsonObjectBody<CreateGanttCurriculumEventDayMapping>(
                request,
            );

        // Validate required fields for creation
        if (!body.moduleId || !body.dayId) {
            throw new ClientApiError(
                "Missing required fields: moduleId or dayId.",
            );
        }

        const mapping = await createCurriculumModuleDayMapping({
            curriculumId,
            moduleId: body.moduleId,
            eventId: body.eventId,
            dayId: body.dayId,
            sortOrder: body.sortOrder,
        });

        return ApiSuccess(mapping);
    },
);

/**
 * PATCH: Updates or reorders an existing mapping.
 */
export const PATCH = withApi(
    async (request: NextRequest, context: RouteContext) => {
        await requireStaffSession();
        const { id: curriculumId } = await context.params;
        const body =
            await requireJsonObjectBody<Record<string, unknown>>(request);

        const { eventId, moduleId, oldMapping, newValues } = body as {
            moduleId: GanttModuleId;
            eventId?: GanttEventId | null;
            oldMapping: { dayId: GanttDayId };
            newValues: { dayId?: GanttDayId; sortOrder?: number };
        };
        if (!moduleId || !oldMapping || !oldMapping.dayId) {
            throw new ClientApiError(
                "Missing oldMapping or eventId identifiers to locate the record.",
            );
        }

        const updated = await updateCurriculumModuleDayMapping(
            curriculumId,
            moduleId,
            eventId ?? null,
            oldMapping,
            newValues,
        );
        return ApiSuccess(updated);
    },
);

/**
 * DELETE: Removes a module mapping.
 */
export const DELETE = withApi(
    async (request: NextRequest, context: RouteContext) => {
        await requireStaffSession();
        const { id: curriculumId } = await context.params;
        const body =
            await requireJsonObjectBody<Record<string, unknown>>(request);

        const { moduleId, eventId, dayId } = body as {
            moduleId: GanttModuleId;
            eventId: GanttEventId;
            dayId: GanttDayId;
        };
        if (!moduleId || !dayId) {
            throw new ClientApiError(
                "Missing identifiers (moduleId or dayIndex) for deletion.",
            );
        }

        const deleted = await deleteCurriculumModuleDayMapping(
            curriculumId,
            moduleId,
            eventId,
            dayId,
        );
        return ApiSuccess(deleted);
    },
);
