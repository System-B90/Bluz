import { NextRequest } from "next/server";

import { ApiSuccess, withApi } from "@/api-server/common";
import { DbModule } from "@/api-server/gantt/db-module";
import { ClientApiError } from "@/api-shared/errors";
import { GanttEventId, GanttModuleId } from "@/api-shared/types/gantt/models";

type RouteContext = { params: Promise<{ id: string }> };

export const POST = withApi(async (request: NextRequest, context: RouteContext) => {
    const { id } = await context.params;
    if (!id) throw new ClientApiError("Module ID is required.");

    const body = await request.text();
    if (!body) throw new ClientApiError("Payload cannot be empty.");

    const { eventIds } = JSON.parse(body) as { eventIds: Array<GanttEventId> };
    if (!Array.isArray(eventIds))
        throw new ClientApiError("eventIds must be an array.");

    await DbModule.reorderEvents(id as GanttModuleId, eventIds);
    return ApiSuccess({ ok: true });
});
