import { NextRequest } from "next/server";

import { ApiSuccess, catchHandler } from "@/api-server/common";
import { DbSyllabus } from "@/api-server/gantt/db-syllabus";
import { ClientApiError } from "@/api-shared/errors";
import { GanttModuleId, GanttSyllabusId } from "@/api-shared/types/gantt/models";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
    try {
        const { id } = await context.params;
        if (!id) throw new ClientApiError("Syllabus ID is required.");

        const body = await request.text();
        if (!body) throw new ClientApiError("Payload cannot be empty.");

        const { moduleIds } = JSON.parse(body) as { moduleIds: Array<GanttModuleId> };
        if (!Array.isArray(moduleIds))
            throw new ClientApiError("moduleIds must be an array.");

        await DbSyllabus.reorderModules(id as GanttSyllabusId, moduleIds);
        return ApiSuccess({ ok: true });
    } catch (error) {
        return catchHandler(request, error);
    }
}
