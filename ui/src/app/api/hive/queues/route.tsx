export const dynamic = "force-dynamic";

import { ApiSuccess, ServerApi, withApi } from "@/api-server/common";
import { createHiveClient } from "@/api-server/hive/session-client";
import { ClientApiError } from "@/api-shared/errors";
import {
    ApiHiveQueuesGetPayload,
    ApiHiveQueuesGetResponse,
} from "@/api-shared/types/hive";

type ServerApiHiveQueuesGet = ServerApi<
    ApiHiveQueuesGetPayload,
    ApiHiveQueuesGetResponse
>;

/**
 * GET /api/hive/queues?module=<id> — the queues of one Hive module, for the
 * event dialog's per-shuffle queue picker. Module-scoped by design: Hive
 * rejects user queues on a lesson rule, so an unscoped list would offer
 * choices that cannot be saved.
 */
export const GET: ServerApiHiveQueuesGet = withApi(async (request) => {
    const moduleId = Number(new URL(request.url).searchParams.get("module"));
    if (!moduleId) {
        throw new ClientApiError("יש לספק מודול לשליפת התורים.");
    }

    const hiveClient = await createHiveClient();
    return ApiSuccess(await hiveClient.getModuleQueues(moduleId));
});
