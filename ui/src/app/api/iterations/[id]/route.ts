export const dynamic = "force-dynamic";

import {
    ApiSuccess,
    requireJsonObjectBody,
    ServerApiWithParams,
    withApi,
} from "@/api-server/common";
import { DbIterations } from "@/api-server/db-iterations";
import { requireStaffSession } from "@/api-server/session-user";
import { ClientApiError } from "@/api-shared/errors";
import { Iteration, PatchIterationPayload } from "@/api-shared/types/iteration";

type ServerApiIterationGet = ServerApiWithParams<
    void,
    Iteration | null,
    { id: string }
>;
type ServerApiIterationPatch = ServerApiWithParams<
    PatchIterationPayload,
    Iteration,
    { id: string }
>;
type ServerApiIterationDelete = ServerApiWithParams<
    void,
    { deleted: true },
    { id: string }
>;

export const GET: ServerApiIterationGet = withApi(async (request, context) => {
    await requireStaffSession();
    const { id } = await context.params;
    return ApiSuccess(await DbIterations.get(id));
});

export const PATCH: ServerApiIterationPatch = withApi(
    async (request, context) => {
        await requireStaffSession();
        const { id } = await context.params;
        const patch =
            await requireJsonObjectBody<Record<string, unknown>>(request);
        if (!patch || typeof patch !== "object") {
            throw new ClientApiError("No patch data provided!");
        }
        return ApiSuccess(await DbIterations.patch(id, patch));
    },
);

export const DELETE: ServerApiIterationDelete = withApi(
    async (request, context) => {
        await requireStaffSession();
        const { id } = await context.params;
        await DbIterations.remove(id);
        return ApiSuccess({ deleted: true });
    },
);
