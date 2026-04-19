/**
 * Name: route.ts
 * Purpose: Route handlers for managing Gantt relational and temporal constraints.
 * Created: 2026-04-19
 * Author: Michael K. Steinberg
 */

import { NextRequest } from "next/server";

import { ApiSuccess, catchHandler } from "@/api-server/common";
import
    {
        createConstraint,
        deleteConstraint,
        getConstraintsForCurriculum,
        updateConstraint,
    } from "@/api-server/gantt/db-constraints";
import { ClientApiError } from "@/api-shared/errors";
import { GanttCurriculumId } from "@/api-shared/types/gantt/models";

export interface RouteContext
{
    params: Promise<{ id: string; }>;
}

/**
 * GET: Fetches all constraints associated with a curriculum's modules and events.
 */
export async function GET(request: NextRequest, context: RouteContext)
{
    try
    {
        const { id } = await context.params;
        if (!id) throw new ClientApiError("Curriculum ID is missing.");

        const constraints = await getConstraintsForCurriculum(id as GanttCurriculumId);
        return ApiSuccess(constraints);
    } catch (error)
    {
        return catchHandler(request, error);
    }
}

/**
 * POST: Creates a new relational or temporal constraint.
 */
export async function POST(request: NextRequest, context: RouteContext)
{
    try
    {
        const body = await request.json();

        if (!body.type)
        {
            throw new ClientApiError("Missing required field: type.");
        }

        if (!body.ownerEventId && !body.ownerModuleId)
        {
            throw new ClientApiError(
                "A constraint must have an owner identified by ownerEventId or ownerModuleId."
            );
        }

        if (body.type === "RELATIONAL" && (!body.targetEventId && !body.targetModuleId))
        {
            throw new ClientApiError(
                "Relational constraints must specify a targetEventId or targetModuleId."
            );
        }

        const constraint = await createConstraint(body);

        return ApiSuccess(constraint);
    } catch (error)
    {
        return catchHandler(request, error);
    }
}

/**
 * PATCH: Updates an existing constraint.
 */
export async function PATCH(request: NextRequest, context: RouteContext)
{
    try
    {
        const body = await request.json();

        const { id: constraintId, ...newValues } = body;

        if (!constraintId)
        {
            throw new ClientApiError("Missing constraint id for update.");
        }

        const updated = await updateConstraint(constraintId, newValues);
        return ApiSuccess(updated);
    } catch (error)
    {
        return catchHandler(request, error);
    }
}

/**
 * DELETE: Removes a constraint.
 */
export async function DELETE(request: NextRequest, context: RouteContext)
{
    try
    {
        const body = await request.json();

        const { id: constraintId } = body;

        if (!constraintId)
        {
            throw new ClientApiError("Missing constraint id for deletion.");
        }

        const deleted = await deleteConstraint(constraintId);
        return ApiSuccess(deleted);
    } catch (error)
    {
        return catchHandler(request, error);
    }
}