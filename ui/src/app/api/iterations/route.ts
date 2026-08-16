export const dynamic = "force-dynamic";

import { ApiSuccess, ServerApi, withApi } from "@/api-server/common";
import { DbIterations } from "@/api-server/db-iterations";
import { buildHiveCache } from "@/api-server/hive/build-cache";
import { requireStaffSession } from "@/api-server/session-user";
import { ClientApiError } from "@/api-shared/errors";
import {
    Iteration,
    RegisterIterationPayload,
} from "@/api-shared/types/iteration";

type ServerApiIterationsList = ServerApi<void, Array<Iteration>>;
type ServerApiIterationRegister = ServerApi<
    RegisterIterationPayload,
    Iteration
>;

export const GET: ServerApiIterationsList = withApi(async (_request) => {
    return ApiSuccess(await DbIterations.list());
});

export const POST: ServerApiIterationRegister = withApi(async (request) => {
    await requireStaffSession();
    const payload = await request.json();
    if (!payload || !payload.id || !payload.label) {
        throw new ClientApiError("Iteration id and label are required!");
    }
    // Cache Hive names for this iteration's instance unless one was supplied.
    const hiveCache =
        payload.hiveCache ?? (await buildHiveCache(payload.hiveUrl));
    return ApiSuccess(
        await DbIterations.register({ ...payload, hiveCache }),
    );
});
