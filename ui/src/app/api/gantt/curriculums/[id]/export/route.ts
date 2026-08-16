import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";

import { ApiSuccess, withApi } from "@/api-server/common";
import { postgresDb } from "@/api-server/gantt";
import { getConstraintsForCurriculum } from "@/api-server/gantt/db-constraints";
import { DbCurriculum } from "@/api-server/gantt/db-curriculum";
import { ganttCurriculumEventDayMappingsSchema } from "@/api-server/gantt/schema/mappings";
import { requireStaffSession } from "@/api-server/session-user";
import { ClientApiError } from "@/api-shared/errors";
import { GanttCurriculumId } from "@/api-shared/types/gantt/models";

export const dynamic = "force-dynamic";

export type RouteContext = {
    params: Promise<{ id: string }>;
};

export const GET = withApi(async (request: NextRequest, context: RouteContext) => {
    await requireStaffSession();
    const { id } = await context.params;
    if (!id) throw new ClientApiError("Curriculum ID is missing.");

    const cid = id as GanttCurriculumId;

    // Fetch full hierarchical curriculum tree
    const curriculum = await DbCurriculum.getItem(cid);

    // Fetch day mappings
    const mappings = await postgresDb
        .select()
        .from(ganttCurriculumEventDayMappingsSchema)
        .where(eq(ganttCurriculumEventDayMappingsSchema.curriculumId, cid));

    // Fetch constraints
    const constraints = await getConstraintsForCurriculum(cid);

    return ApiSuccess({
        version: "1.0",
        curriculum,
        mappings,
        constraints,
    });
});
