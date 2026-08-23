import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";

import { withApi } from "@/api-server/common";
import { postgresDb } from "@/api-server/gantt";
import { DbCurriculum } from "@/api-server/gantt/db-curriculum";
import { ganttCurriculumEventDayMappingsSchema } from "@/api-server/gantt/schema/mappings";
import { createHiveClient } from "@/api-server/hive/session-client";
import { requireStaffSession } from "@/api-server/session-user";
import { safeTitle } from "@/api-shared/common";
import { ClientApiError } from "@/api-shared/errors";
import { GanttCurriculumId } from "@/api-shared/types/gantt/models";
import { buildGanttExcelWorkbook } from "@/app/api/gantt/curriculums/[id]/export/excel/workbook";

export const dynamic = "force-dynamic";

export type RouteContext = {
    params: Promise<{ id: string }>;
};

/**
 * Hive user id → display name for the export's "אחראי" column. Hive being
 * unreachable degrades the column to raw ids rather than failing the whole
 * export, which is the more useful outcome for the person downloading it.
 */
async function getHiveUserNames(): Promise<Map<number, string>> {
    try {
        const hiveClient = await createHiveClient();
        const users = await hiveClient.getUsers();
        return new Map(users.map((user) => [user.id, user.display_name]));
    } catch {
        return new Map();
    }
}

export const GET = withApi(
    async (request: NextRequest, context: RouteContext) => {
        await requireStaffSession();
        const { id } = await context.params;
        if (!id) throw new ClientApiError("Curriculum ID is missing.");

        const cid = id as GanttCurriculumId;

        const curriculum = await DbCurriculum.getItem(cid);
        const mappings = await postgresDb
            .select()
            .from(ganttCurriculumEventDayMappingsSchema)
            .where(eq(ganttCurriculumEventDayMappingsSchema.curriculumId, cid));

        const workbook = await buildGanttExcelWorkbook(
            curriculum,
            mappings,
            await getHiveUserNames(),
        );

        const buffer = await workbook.xlsx.writeBuffer();
        const filename = `bluz-gantt-${safeTitle(curriculum.title)}.xlsx`;
        const encodedFilename = encodeURIComponent(filename);

        const headers = new Headers();
        headers.set(
            "Content-Type",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        );
        headers.set(
            "Content-Disposition",
            `attachment; filename*=UTF-8''${encodedFilename}`,
        );
        headers.set("Cache-Control", "no-store, max-age=0");

        return new Response(buffer, { status: 200, headers });
    },
);
