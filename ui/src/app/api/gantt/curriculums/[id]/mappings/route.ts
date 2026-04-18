/**
 * Name: route.ts
 * Purpose: Route handlers for curriculum module assignments (cMDA).
 * Created: 2026-04-15
 * Author: Michael K. Steinberg
 */

import { NextRequest } from "next/server";

import { ApiSuccess, catchHandler } from "@/api-server/common";
import
{
    createCurriculumModuleDayMapping,
    deleteCurriculumModuleDayMapping,
    getModuleDayMappingsForCurriculum,
    updateCurriculumModuleDayMapping,
} from "@/api-server/gantt/db-mappings";
import { ClientApiError } from "@/api-shared/errors";
import { CreateGanttCurriculumEventDayMapping } from "@/api-shared/types/gantt/create-payloads";
import
{
    GanttDayId,
    GanttEventId,
    GanttModuleId,
} from "@/api-shared/types/gantt/models";

export interface RouteContext
{
    params: Promise<{ id: string; }>;
}

/**
 * GET: Fetches assignments for a curriculum.
 */
export async function GET(request: NextRequest, context: RouteContext)
{
    try
    {
        const { id } = await context.params;
        if (!id) throw new ClientApiError("Curriculum ID is missing.");

        const dayIds = request.nextUrl.searchParams.getAll("dayId");

        const mappings = await getModuleDayMappingsForCurriculum(id, { dayIds });
        return ApiSuccess(mappings);
    } catch (error)
    {
        return catchHandler(request, error);
    }
}

/**
 * POST: Creates a new module-to-day mapping.
 */
export async function POST(request: NextRequest, context: RouteContext)
{
    try
    {
        const { id: curriculumId } = await context.params;
        const body: CreateGanttCurriculumEventDayMapping = await request.json();

        // Validate required fields for creation
        if (!body.moduleId || !body.dayId)
        {
            throw new ClientApiError("Missing required fields: moduleId or dayId.");
        }

        const mapping = await createCurriculumModuleDayMapping({
            curriculumId,
            moduleId: body.moduleId,
            eventId: body.eventId,
            dayId: body.dayId,
            sortOrder: body.sortOrder,
        });

        return ApiSuccess(mapping);
    } catch (error)
    {
        return catchHandler(request, error);
    }
}

/**
 * PATCH: Updates or reorders an existing mapping.
 */
export async function PATCH(request: NextRequest, context: RouteContext)
{
    try
    {
        const { id: curriculumId } = await context.params;
        const body = await request.json();

        const { eventId, moduleId, oldMapping, newValues } = body as {
            moduleId: GanttModuleId;
            eventId?: GanttEventId | null;
            oldMapping: { dayId: GanttDayId; };
            newValues: { dayId?: GanttDayId; sortOrder?: number; };
        };
        if (!moduleId || !oldMapping.dayId)
        {
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
    } catch (error)
    {
        return catchHandler(request, error);
    }
}

/**
 * DELETE: Removes a module mapping.
 */
export async function DELETE(request: NextRequest, context: RouteContext)
{
    try
    {
        const { id: curriculumId } = await context.params;
        const body = await request.json();

        const { moduleId, eventId, dayId } = body as {
            moduleId: GanttModuleId;
            eventId: GanttEventId;
            dayId: GanttDayId;
        };
        if (!moduleId || !dayId)
        {
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
    } catch (error)
    {
        return catchHandler(request, error);
    }
}
