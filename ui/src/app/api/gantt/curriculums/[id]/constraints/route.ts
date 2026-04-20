/**
 * Name: route.ts
 * Purpose: Route handlers for managing Gantt relational and temporal constraints.
 * Created: 2026-04-19
 * Author: Michael K. Steinberg
 */

import { randomUUID } from "crypto";

import { NextRequest } from "next/server";

import { CreateConstraintPayload } from "@/api-client/gantt/constraints";
import { ApiSuccess, catchHandler } from "@/api-server/common";
import
{
    createConstraint,
    deleteConstraint,
    getConstraintsForCurriculum,
    getConstraintsForModule,
    getConstraintsForSyllabus,
    updateConstraint,
} from "@/api-server/gantt/db-constraints";
import { ClientApiError } from "@/api-shared/errors";
import { GanttCurriculumId } from "@/api-shared/types/gantt/models";

export type RouteContext = {
    params: Promise<{ id: string; }>;
};

/**
 * GET: Fetches all constraints associated with a curriculum's modules and events.
 */
export async function GET(request: NextRequest, context: RouteContext)
{
    try
    {
        const { id } = await context.params;
        if (!id) throw new ClientApiError("Curriculum ID is missing.");

        const syllabusId = request.nextUrl.searchParams.get("syllabusId");
        const moduleId = request.nextUrl.searchParams.get("moduleId");

        if (moduleId)
        {
            return ApiSuccess(await getConstraintsForModule(moduleId));
        }
        else if (syllabusId)
        {
            return ApiSuccess(await getConstraintsForSyllabus(syllabusId));
        }

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
export async function POST(request: NextRequest, _context: RouteContext/** Constraints are not unique to a curriculum, but to a syllabus. The API is under curriculum for efficiency when fetching */)
{
    try
    {
        const body: CreateConstraintPayload = await request.json();

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

        if (body.type === "RELATIONAL" && (!body.targetId))
        {
            throw new ClientApiError(
                "Relational constraints must specify a targetId."
            );
        }

        const creationData: Parameters<typeof createConstraint>[ 0 ] = {
            id: randomUUID(),
            createdAt: new Date(),
            updatedAt: new Date(),
            'type': body.type,
            'ownerEventId': body.ownerType === 'event' ? body.ownerEventId : undefined,
            'ownerModuleId': body.ownerType === 'module' ? body.ownerModuleId : undefined,
            'targetEventId': body.targetType === 'event' ? body.targetEventId : undefined,
            'targetModuleId': body.targetType === 'module' ? body.targetModuleId : undefined,
            'relation': body.type === 'RELATIONAL' ? body.relation : undefined,
            'minDelayDays': body.type === 'RELATIONAL' ? body.minDelayDays : undefined,
            'maxDelayDays': body.type === 'RELATIONAL' ? body.maxDelayDays : undefined,
        };

        const constraint = await createConstraint(creationData);

        return ApiSuccess(constraint);
    } catch (error)
    {
        return catchHandler(request, error);
    }
}

/**
 * PATCH: Updates an existing constraint.
 */
export async function PATCH(request: NextRequest, _context: RouteContext)
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
export async function DELETE(request: NextRequest, _context: RouteContext)
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
