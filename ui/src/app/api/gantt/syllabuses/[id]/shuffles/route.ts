import { NextRequest } from "next/server";

import { ApiSuccess, parseJsonBody, withApi } from "@/api-server/common";
import { DbSyllabus } from "@/api-server/gantt/db-syllabus";
import { requireStaffSession } from "@/api-server/session-user";
import { ClientApiError } from "@/api-shared/errors";
import {
    isShuffleDescriptions,
    isShuffleNameList,
    normalizeShuffleNames,
} from "@/api-shared/gantt/shuffle-names";
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
 * Lists the modules and events using the shuffle names in `?name=a&name=b`, so
 * the UI can show what a deletion would strip before it happens (#485).
 *
 * One param per name because a shuffle name may itself contain a comma; the
 * comma-joined `?names=a,b` form is still read for older clients.
 */
export const GET = withApi(
    async (request: NextRequest, context: RouteContext) => {
        await requireStaffSession();
        const id = await resolveSyllabusId(context);

        const params = request.nextUrl.searchParams;
        const names = normalizeShuffleNames([
            ...params.getAll("name"),
            ...(params.get("names") ?? "").split(","),
        ]);

        return ApiSuccess(await DbSyllabus.findShuffleUsages(id, names));
    },
);

/**
 * Applies the new shuffle list, cascading removals onto modules and events.
 * An optional `descriptions` (name → text) replaces the shuffle descriptions.
 */
export const POST = withApi(
    async (request: NextRequest, context: RouteContext) => {
        await requireStaffSession();
        const id = await resolveSyllabusId(context);

        const body = await request.text();
        if (!body) throw new ClientApiError("Payload cannot be empty.");

        const { descriptions, shuffles } = parseJsonBody<{
            descriptions?: unknown;
            shuffles: unknown;
        }>(body);
        if (!isShuffleNameList(shuffles))
            throw new ClientApiError("shuffles must be an array of strings.");
        if (descriptions !== undefined && !isShuffleDescriptions(descriptions))
            throw new ClientApiError(
                "descriptions must be an object of strings.",
            );

        return ApiSuccess(
            await DbSyllabus.applyShuffles(id, shuffles, descriptions),
        );
    },
);
