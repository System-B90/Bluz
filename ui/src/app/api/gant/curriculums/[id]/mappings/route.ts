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
        createModuleAssignment,
        deleteModuleAssignment,
        getModuleAssignments,
        updateModuleAssignment
    } from "@/api-server/gantt/db-mappings";
import { ClientApiError } from "@/api-shared/errors";

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
        if (!id) throw new ClientApiError('Curriculum ID is missing.');

        const rawWeekIndex = request.nextUrl.searchParams.get('weekId');
        const weekId = rawWeekIndex !== null ? Number(rawWeekIndex) : undefined;

        const assignments = await getModuleAssignments(id, weekId);
        return ApiSuccess(assignments);
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
        const body = await request.json();

        // Validate required fields for creation
        if (!body.moduleId || body.weekId === undefined || body.dayIndex === undefined)
        {
            throw new ClientApiError('Missing required fields: moduleId, weekId, or dayIndex.');
        }

        const mapping = await createModuleAssignment({
            curriculumId,
            moduleId: body.moduleId,
            weekId: body.weekId,
            dayIndex: body.dayIndex,
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

        const { oldMapping, newValues } = body;
        if (!oldMapping?.moduleId || oldMapping.weekId === undefined || oldMapping.dayIndex === undefined)
        {
            throw new ClientApiError('Missing oldMapping identifiers to locate the record.');
        }

        const updated = await updateModuleAssignment(curriculumId, oldMapping, newValues);
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

        const { moduleId, weekId, dayIndex } = body;
        if (!moduleId || weekId === undefined || dayIndex === undefined)
        {
            throw new ClientApiError('Missing identifiers (moduleId, weekId, dayIndex) for deletion.');
        }

        const deleted = await deleteModuleAssignment(curriculumId, moduleId, weekId, dayIndex);
        return ApiSuccess(deleted);
    } catch (error)
    {
        return catchHandler(request, error);
    }
}
