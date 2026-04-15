/**
 * Name: route.ts
 * Purpose: Route handlers for curriculum module assignments (cMDA).
 * Created: 2026-04-15
 * Author: Michael K. Steinberg
 */

import { ApiSuccess, catchHandler } from "@/api-server/common";
import
    {
        createModuleAssignment,
        deleteModuleAssignment,
        getModuleAssignments,
        updateModuleAssignment
    } from "@/api-server/curriculum/db-mappings";
import { ClientApiError } from "@/api-shared/errors";
import { NextRequest } from "next/server";

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

        const rawWeekIndex = request.nextUrl.searchParams.get('weekIndex');
        const weekIndex = rawWeekIndex !== null ? Number(rawWeekIndex) : undefined;

        const assignments = await getModuleAssignments(id, weekIndex);
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
        if (!body.moduleId || body.weekIndex === undefined || body.dayIndex === undefined)
        {
            throw new ClientApiError('Missing required fields: moduleId, weekIndex, or dayIndex.');
        }

        const assignment = await createModuleAssignment({
            curriculumId,
            moduleId: body.moduleId,
            weekIndex: body.weekIndex,
            dayIndex: body.dayIndex,
            sortOrder: body.sortOrder,
        });

        return ApiSuccess(assignment);
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
        if (!oldMapping?.moduleId || oldMapping.weekIndex === undefined || oldMapping.dayIndex === undefined)
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

        const { moduleId, weekIndex, dayIndex } = body;
        if (!moduleId || weekIndex === undefined || dayIndex === undefined)
        {
            throw new ClientApiError('Missing identifiers (moduleId, weekIndex, dayIndex) for deletion.');
        }

        const deleted = await deleteModuleAssignment(curriculumId, moduleId, weekIndex, dayIndex);
        return ApiSuccess(deleted);
    } catch (error)
    {
        return catchHandler(request, error);
    }
}
