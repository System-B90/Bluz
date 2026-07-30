import { NextRequest } from "next/server";

import { ApiCacheControl } from "@/api-server/common";
import {
    DatabaseController,
    resolveIterationDb,
    resolveWritableIterationDb,
} from "@/api-server/mongo-db-controller";
import {
    Iteration,
    ITERATION_QUERY_PARAM,
    IterationId,
} from "@/api-shared/types/iteration";
import { ARCHIVED_HIVE_CACHE_TTL } from "@/settings";

export { ITERATION_QUERY_PARAM };

/**
 * Cache directive for a response built from an archived iteration's frozen
 * Hive snapshot: a week, and `private` because every route sits behind Hive
 * SSO and a shared cache must not hold a copy. The current iteration is live
 * data, so it gets no directive at all.
 */
export function archivedIterationCacheControl(
    iteration: Iteration | null | undefined,
): ApiCacheControl | undefined {
    if (!iteration || iteration.isCurrent) return undefined;
    return { maxAge: ARCHIVED_HIVE_CACHE_TTL, scope: "private" };
}

export type ResolvedIteration = {
    /** The iteration id from the request, or undefined for the current run. */
    iterationId?: IterationId;
    /** Controller scoped to that iteration's database. */
    controller: DatabaseController;
};

/**
 * Resolve the iteration a calendar request targets. An absent `it` query param
 * means the current iteration (backward compatible). Use for read paths.
 */
export async function resolveIterationFromRequest(
    request: { nextUrl: URL } | { url: string } | NextRequest,
): Promise<ResolvedIteration> {
    const url =
        "nextUrl" in request
            ? (request.nextUrl as URL)
            : new URL((request as { url: string }).url);
    const raw = url.searchParams.get(ITERATION_QUERY_PARAM);
    const iterationId = raw && raw.length > 0 ? raw : undefined;
    const controller = await resolveIterationDb(iterationId);
    return { iterationId, controller };
}

/**
 * Same as {@link resolveIterationFromRequest} but rejects writes to a past
 * (non-current) iteration. Use for POST/PUT/PATCH/DELETE handlers.
 * Uses a single DB lookup (existence + isCurrent check combined).
 */
export async function resolveWritableIterationFromRequest(
    request: { nextUrl: URL } | { url: string } | NextRequest,
): Promise<ResolvedIteration> {
    const url =
        "nextUrl" in request
            ? (request.nextUrl as URL)
            : new URL((request as { url: string }).url);
    const raw = url.searchParams.get(ITERATION_QUERY_PARAM);
    const iterationId = raw && raw.length > 0 ? raw : undefined;
    const controller = await resolveWritableIterationDb(iterationId);
    return { iterationId, controller };
}
