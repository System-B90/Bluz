import { NextRequest } from "next/server";

import { ApiSuccess, parseJsonBody, withApi } from "@/api-server/common";
import { DbSyllabus } from "@/api-server/gantt/db-syllabus";
import { requireStaffSession } from "@/api-server/session-user";
import { ClientApiError } from "@/api-shared/errors";
import {
    GanttModuleId,
    GanttSyllabusId,
} from "@/api-shared/types/gantt/models";

type RouteContext = { params: Promise<{ id: string }> };

export const POST = withApi(
    async (request: NextRequest, context: RouteContext) => {
        await requireStaffSession();
        const { id } = await context.params;
        if (!id) throw new ClientApiError("Syllabus ID is required.");

        const body = await request.text();
        if (!body) throw new ClientApiError("Payload cannot be empty.");

        const { moduleIds } = parseJsonBody<{
            moduleIds: Array<GanttModuleId>;
        }>(body);
        if (!Array.isArray(moduleIds))
            throw new ClientApiError("moduleIds must be an array.");

        await DbSyllabus.reorderModules(id as GanttSyllabusId, moduleIds);
        return ApiSuccess({ ok: true });
    },
);
