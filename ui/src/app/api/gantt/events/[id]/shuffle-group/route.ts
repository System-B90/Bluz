export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";

import { ApiSuccess, parseJsonBody, withApi } from "@/api-server/common";
import { DbModuleEvent } from "@/api-server/gantt/db-module-event";
import { requireStaffSession } from "@/api-server/session-user";
import { ClientApiError } from "@/api-shared/errors";
import { GanttModuleId } from "@/api-shared/types/gantt/models";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Reconciles this event's shuffle group against the requested shuffle names,
 * creating one sibling event per name (#699). Fewer than two names ungroups.
 */
export const POST = withApi(
    async (request: NextRequest, context: RouteContext) => {
        await requireStaffSession();

        const { id } = await context.params;
        if (!id) throw new ClientApiError("Event ID is required.");

        const body = await request.text();
        if (!body) throw new ClientApiError("Payload cannot be empty.");

        const { moduleId, shuffles } = parseJsonBody<{
            moduleId: GanttModuleId;
            shuffles: Array<string>;
        }>(body);

        if (!moduleId) throw new ClientApiError("moduleId is required.");
        if (!Array.isArray(shuffles)) {
            throw new ClientApiError("shuffles must be an array.");
        }

        return ApiSuccess(
            await DbModuleEvent.applyShuffleGroup(id, moduleId, shuffles),
        );
    },
);
