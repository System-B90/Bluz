import { NextRequest } from "next/server";

import { ApiSuccess, parseJsonBody, withApi } from "@/api-server/common";
import { DbSyllabus } from "@/api-server/gantt/db-syllabus";
import { requireStaffSession } from "@/api-server/session-user";
import { ClientApiError } from "@/api-shared/errors";
import { isShuffleNameList } from "@/api-shared/gantt/shuffle-names";
import { GanttSyllabusId } from "@/api-shared/types/gantt/models";

type RouteContext = { params: Promise<{ id: string }> };

async function resolveSyllabusId(
    context: RouteContext,
): Promise<GanttSyllabusId> {
    const { id } = await context.params;
    if (!id) throw new ClientApiError("Syllabus ID is required.");
    return id as GanttSyllabusId;
}

/**
 * Lists the modules and events using the shuffle names in `?names=a,b`, so the
 * UI can show what a deletion would strip before it happens (#485).
 */
export const GET = withApi(
    async (request: NextRequest, context: RouteContext) => {
        await requireStaffSession();
        const id = await resolveSyllabusId(context);

        const names = (request.nextUrl.searchParams.get("names") ?? "")
            .split(",")
            .map((name) => name.trim())
            .filter(Boolean);

        return ApiSuccess(await DbSyllabus.findShuffleUsages(id, names));
    },
);

/** Applies the new shuffle list, cascading removals onto modules and events. */
export const POST = withApi(
    async (request: NextRequest, context: RouteContext) => {
        await requireStaffSession();
        const id = await resolveSyllabusId(context);

        const body = await request.text();
        if (!body) throw new ClientApiError("Payload cannot be empty.");

        const { shuffles } = parseJsonBody<{ shuffles: unknown }>(body);
        if (!isShuffleNameList(shuffles))
            throw new ClientApiError("shuffles must be an array of strings.");

        return ApiSuccess(await DbSyllabus.applyShuffles(id, shuffles));
    },
);
