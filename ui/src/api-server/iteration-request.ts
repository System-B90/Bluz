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

/** Request shapes a handler can hand to the resolvers below. */
type IterationRequestLike = { nextUrl: URL } | { url: string } | NextRequest;

/**
 * Read the `it` query param off a request. Absent or empty means the current
 * iteration (backward compatible with single-iteration callers).
 */
export function iterationIdFromRequest(
    request: IterationRequestLike,
): IterationId | undefined {
    const url =
        "nextUrl" in request
            ? (request.nextUrl as URL)
            : new URL((request as { url: string }).url);
    const raw = url.searchParams.get(ITERATION_QUERY_PARAM);
    return raw && raw.length > 0 ? raw : undefined;
}

/**
 * Resolve the iteration a calendar request targets. Use for read paths.
 */
export async function resolveIterationFromRequest(
    request: IterationRequestLike,
): Promise<ResolvedIteration> {
    const iterationId = iterationIdFromRequest(request);
    return { iterationId, controller: await resolveIterationDb(iterationId) };
}

/**
 * Same as {@link resolveIterationFromRequest} but rejects writes to a past
 * (non-current) iteration. Use for POST/PUT/PATCH/DELETE handlers.
 * Uses a single DB lookup (existence + isCurrent check combined).
 */
export async function resolveWritableIterationFromRequest(
    request: IterationRequestLike,
): Promise<ResolvedIteration> {
    const iterationId = iterationIdFromRequest(request);
    return {
        iterationId,
        controller: await resolveWritableIterationDb(iterationId),
    };
}
