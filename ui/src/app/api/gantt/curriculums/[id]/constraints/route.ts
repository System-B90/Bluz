/**
 * Name: route.ts
 * Purpose: Route handlers for managing Gantt relational and temporal constraints.
 * Created: 2026-04-19
 * Author: Michael K. Steinberg
 */

import { NextRequest } from "next/server";

import { ApiSuccess, withApi } from "@/api-server/common";
import {
    createConstraint,
    deleteConstraint,
    getConstraintsForCurriculum,
    getConstraintsForModule,
    getConstraintsForSyllabus,
    updateConstraint,
} from "@/api-server/gantt/db-constraints";
import { requireStaffSession } from "@/api-server/session-user";
import { ClientApiError } from "@/api-shared/errors";
import { CreateConstraintPayload } from "@/api-shared/types/gantt/create-payloads";
import { GanttCurriculumId } from "@/api-shared/types/gantt/models";

export type RouteContext = {
    params: Promise<{ id: string }>;
};

/**
 * GET: Fetches all constraints associated with a curriculum's modules and events.
 */
export const GET = withApi(async (request: NextRequest, context: RouteContext) => {
    await requireStaffSession();
    const { id } = await context.params;
    if (!id) throw new ClientApiError("Curriculum ID is missing.");

    const syllabusId = request.nextUrl.searchParams.get("syllabusId");
    const moduleId = request.nextUrl.searchParams.get("moduleId");

    if (moduleId) {
        return ApiSuccess(await getConstraintsForModule(moduleId));
    } else if (syllabusId) {
        return ApiSuccess(await getConstraintsForSyllabus(syllabusId));
    }

    const constraints = await getConstraintsForCurriculum(
        id as GanttCurriculumId,
    );
    return ApiSuccess(constraints);
});

/**
 * POST: Creates a new relational or temporal constraint.
 */
export const POST = withApi(async (
    request: NextRequest,
    _context: RouteContext /** Constraints are not unique to a curriculum, but to a syllabus. The API is under curriculum for efficiency when fetching */,
) => {
    await requireStaffSession();
    const body: CreateConstraintPayload = await request.json();

    if (!body.type) {
        throw new ClientApiError("Missing required field: type.");
    }
    if (!body.id) {
        throw new ClientApiError("Missing required field: id.");
    }

    if (!body.ownerEventId && !body.ownerModuleId) {
        throw new ClientApiError(
            "A constraint must have an owner identified by ownerEventId or ownerModuleId.",
        );
    }

    if (body.type === "RELATIONAL" && !body.targetId) {
        throw new ClientApiError(
            "Relational constraints must specify a targetId.",
        );
    }

    const creationData: Parameters<typeof createConstraint>[0] = {
        id: body.id,
        createdAt: new Date(),
        updatedAt: new Date(),
        type: body.type,
        ownerEventId:
            body.ownerType === "event" ? body.ownerEventId : undefined,
        ownerModuleId:
            body.ownerType === "module" ? body.ownerModuleId : undefined,
        relation: body.type === "RELATIONAL" ? body.relation : undefined,
        minDelayDays:
            body.type === "RELATIONAL" ? body.minDelayDays : undefined,
        maxDelayDays:
            body.type === "RELATIONAL" ? body.maxDelayDays : undefined,
    };
    if (body.type === "TEMPORAL") {
        creationData.allowedDays = body.allowedDays;
        creationData.forbiddenDays = body.forbiddenDays;
    } else {
        creationData[
            body.targetType === "event" ? "targetEventId" : "targetModuleId"
        ] = body.targetId;
    }

    const constraint = await createConstraint(creationData);

    return ApiSuccess(constraint);
});

/**
 * PATCH: Updates an existing constraint.
 */
export const PATCH = withApi(async (request: NextRequest, _context: RouteContext) => {
    await requireStaffSession();
    const body = await request.json();

    const { id: constraintId, ...newValues } = body;

    if (!constraintId) {
        throw new ClientApiError("Missing constraint id for update.");
    }

    const updateData: any = {};
    if (newValues.type !== undefined) updateData.type = newValues.type;
    if (newValues.relation !== undefined)
        updateData.relation = newValues.relation;
    if (newValues.minDelayDays !== undefined)
        updateData.minDelayDays = newValues.minDelayDays;
    if (newValues.maxDelayDays !== undefined)
        updateData.maxDelayDays = newValues.maxDelayDays;
    if (newValues.allowedDays !== undefined)
        updateData.allowedDays = newValues.allowedDays;
    if (newValues.forbiddenDays !== undefined)
        updateData.forbiddenDays = newValues.forbiddenDays;

    if (newValues.type === "RELATIONAL") {
        // Nullify both to clear previous relations properly
        updateData.targetEventId = null;
        updateData.targetModuleId = null;
        if (newValues.targetId) {
            if (newValues.targetType === "event") {
                updateData.targetEventId = newValues.targetId;
            } else {
                updateData.targetModuleId = newValues.targetId;
            }
        }
    }

    const updated = await updateConstraint(constraintId, updateData);
    if (!updated || updated.length === 0) {
        throw new ClientApiError("Failed to update constraint.");
    }
    return ApiSuccess(updated[0]);
});

/**
 * DELETE: Removes a constraint.
 */
export const DELETE = withApi(async (request: NextRequest, _context: RouteContext) => {
    await requireStaffSession();
    const body = await request.json();

    const { id: constraintId } = body;

    if (!constraintId) {
        throw new ClientApiError("Missing constraint id for deletion.");
    }

    const deleted = await deleteConstraint(constraintId);
    return ApiSuccess(deleted);
});
