import { inArray, or } from "drizzle-orm";
import { NextRequest } from "next/server";

import { ApiSuccess, withApi } from "@/api-server/common";
import { postgresDb } from "@/api-server/gantt";
import { DbSyllabus } from "@/api-server/gantt/db-syllabus";
import { ganttConstraintsSchema } from "@/api-server/gantt/schema";
import { requireStaffSession } from "@/api-server/session-user";
import { ClientApiError } from "@/api-shared/errors";
import { GanttSyllabusId } from "@/api-shared/types/gantt/models";
import { SYLLABUS_EXPORT_KIND, SyllabusExportDocument } from "@/api-shared/types/gantt/syllabus-export";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * One syllabus as a file (#757): its modules, events and the constraints they
 * own. `?curriculumId=` names the curriculum whose allocated durations the
 * import should carry over.
 */
export const GET = withApi(
    async (request: NextRequest, context: RouteContext) => {
        await requireStaffSession();
        const { id } = await context.params;
        if (!id) throw new ClientApiError("Syllabus ID is required.");

        const syllabus = await DbSyllabus.getItem(id as GanttSyllabusId);
        const moduleIds = syllabus.s2m.map((row) => row.moduleId);
        const eventIds = syllabus.s2m.flatMap((row) =>
            row.module.m2e.map((link) => link.eventId),
        );

        const owners = [
            ...(moduleIds.length > 0 ? [inArray(ganttConstraintsSchema.ownerModuleId, moduleIds)] : []),
            ...(eventIds.length > 0 ? [inArray(ganttConstraintsSchema.ownerEventId, eventIds)] : []),
        ];
        const constraints = owners.length > 0
            ? await postgresDb.select().from(ganttConstraintsSchema).where(or(...owners))
            : [];

        const document: SyllabusExportDocument = {
            version: "1.0",
            kind: SYLLABUS_EXPORT_KIND,
            sourceCurriculumId: request.nextUrl.searchParams.get("curriculumId") ?? undefined,
            syllabus,
            constraints,
        };
        return ApiSuccess(document);
    },
);
