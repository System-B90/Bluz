export const dynamic = "force-dynamic";

import { ApiSuccess, ServerApi, withApi } from "@/api-server/common";
import { DbIterations } from "@/api-server/db-iterations";
import { requireStaffSession } from "@/api-server/session-user";
import { ClientApiError } from "@/api-shared/errors";
import {
    Iteration,
    IterationId,
    PatchIterationPayload,
} from "@/api-shared/types/iteration";

type ServerApiCurrentIteration = ServerApi<void, Iteration | null>;
type ServerApiCurrentIterationPatch = ServerApi<PatchIterationPayload, Iteration>;
type ServerApiCurrentIterationDelete = ServerApi<void, { deleted: true }>;

/**
 * Installs migrated from before the registry existed carry an iteration whose
 * literal id is "current", and that id collides with this static route segment:
 * `/api/iterations/current` shadows `/api/iterations/[id]` for it. Writes aimed
 * at that iteration therefore landed on whichever iteration happened to *be*
 * current, so "make current" silently re-promoted the wrong row and then failed
 * (#472). Resolve the literal row first and only fall back to the current one.
 */
async function resolveTargetId(): Promise<IterationId> {
    const literal = await DbIterations.get("current");
    if (literal) return literal.id;
    const current = await DbIterations.current();
    return current.id;
}

// Null (not an error) when the registry is empty — a fresh install the UI
// prompts to set up rather than an outage (#471).
export const GET: ServerApiCurrentIteration = withApi(async (_request) => {
    await requireStaffSession();
    return ApiSuccess(await DbIterations.currentOrNull());
});

export const PATCH: ServerApiCurrentIterationPatch = withApi(async (request) => {
    await requireStaffSession();
    const patch = await request.json();
    if (!patch || typeof patch !== "object") {
        throw new ClientApiError("No patch data provided!");
    }
    return ApiSuccess(await DbIterations.patch(await resolveTargetId(), patch));
});

export const DELETE: ServerApiCurrentIterationDelete = withApi(async () => {
    await requireStaffSession();
    await DbIterations.remove(await resolveTargetId());
    return ApiSuccess({ deleted: true });
});
