import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";

import { catchHandler } from "@/api-server/common";
import { postgresDb } from "@/api-server/gantt";
import { getConstraintsForCurriculum } from "@/api-server/gantt/db-constraints";
import { DbCurriculum } from "@/api-server/gantt/db-curriculum";
import { ganttCurriculumEventDayMappingsSchema } from "@/api-server/gantt/schema/mappings";
import { safeTitle } from "@/api-shared/common";
import { ClientApiError } from "@/api-shared/errors";
import { GanttCurriculumId } from "@/api-shared/types/gantt/models";
import { buildGanttExcelWorkbook } from "@/app/api/gantt/curriculums/[id]/export/excel/workbook";

export const dynamic = "force-dynamic";

export type RouteContext = {
    params: Promise<{ id: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
    try {
        const { id } = await context.params;
        if (!id) throw new ClientApiError("Curriculum ID is missing.");

        const cid = id as GanttCurriculumId;

        const curriculum = await DbCurriculum.getItem(cid);
        const mappings = await postgresDb
            .select()
            .from(ganttCurriculumEventDayMappingsSchema)
            .where(eq(ganttCurriculumEventDayMappingsSchema.curriculumId, cid));

        await getConstraintsForCurriculum(cid);

        const workbook = await buildGanttExcelWorkbook(curriculum, mappings);

        const buffer = await workbook.xlsx.writeBuffer();
        const filename = `bluz-gantt-${safeTitle(curriculum.title)}.xlsx`;
        const encodedFilename = encodeURIComponent(filename);

        const headers = new Headers();
        headers.set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        headers.set("Content-Disposition", `attachment; filename*=UTF-8''${encodedFilename}`);
        headers.set("Cache-Control", "no-store, max-age=0");

        return new Response(buffer, { status: 200, headers });
    } catch (error) {
        return catchHandler(request, error);
    }
}
