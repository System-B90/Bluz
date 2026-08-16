export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";

import { ApiSuccess, parseJsonBody, withApi } from "@/api-server/common";
import {
    DbCurriculum,
    DuplicateCurriculumOverrides,
} from "@/api-server/gantt/db-curriculum";
import { requireStaffSession } from "@/api-server/session-user";
import { ClientApiError } from "@/api-shared/errors";
import { GanttCurriculumId } from "@/api-shared/types/gantt/models";

export type RouteContext = {
    params: Promise<{ id: string }>;
};

export const POST = withApi(
    async (request: NextRequest, context: RouteContext) => {
        await requireStaffSession();
        const { id } = await context.params;
        if (!id) {
            throw new ClientApiError("Curriculum ID is missing.");
        }

        // Overrides are optional; the clone falls back to the source's values.
        let overrides: DuplicateCurriculumOverrides = {};
        const textBody = await request.text();
        if (textBody) {
            overrides = parseJsonBody<DuplicateCurriculumOverrides>(textBody);
        }

        const duplicated = await DbCurriculum.duplicateCurriculum(
            id as GanttCurriculumId,
            overrides,
        );

        return ApiSuccess(duplicated);
    },
);
