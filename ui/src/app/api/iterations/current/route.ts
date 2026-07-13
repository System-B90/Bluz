export const dynamic = "force-dynamic";

import { ApiSuccess, catchHandler, ServerApi } from "@/api-server/common";
import { DbIterations } from "@/api-server/db-iterations";
import { ClientApiError } from "@/api-shared/errors";
import { Iteration, PatchIterationPayload } from "@/api-shared/types/iteration";

type ServerApiCurrentIteration = ServerApi<void, Iteration>;
type ServerApiCurrentIterationPatch = ServerApi<PatchIterationPayload, Iteration>;

export const GET: ServerApiCurrentIteration = async (request) => {
    try {
        return ApiSuccess(await DbIterations.current());
    } catch (e) {
        return catchHandler(request, e);
    }
};

/**
 * The current iteration's id is literally "current", which collides with
 * this static route segment and shadows PATCH /api/iterations/[id] for it.
 * Handle PATCH here too so linking/editing the current iteration works.
 */
export const PATCH: ServerApiCurrentIterationPatch = async (request) => {
    try {
        const patch = await request.json();
        if (!patch || typeof patch !== "object") {
            throw new ClientApiError("No patch data provided!");
        }
        const current = await DbIterations.current();
        return ApiSuccess(await DbIterations.patch(current.id, patch));
    } catch (e) {
        return catchHandler(request, e);
    }
};
