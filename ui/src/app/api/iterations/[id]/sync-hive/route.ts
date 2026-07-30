export const dynamic = "force-dynamic";

import {
    ApiSuccess,
    ServerApiWithParams,
    withApi,
} from "@/api-server/common";
import { DbIterations } from "@/api-server/db-iterations";
import { buildHiveCache } from "@/api-server/hive/build-cache";
import { ClientApiError } from "@/api-shared/errors";
import { Iteration } from "@/api-shared/types/iteration";

type ServerApiIterationSyncHive = ServerApiWithParams<
    void,
    Iteration,
    { id: string }
>;

/**
 * Manually re-snapshot the Hive module/subject/room names for an iteration
 * (#379), rather than relying only on the snapshot taken at creation time.
 */
export const POST: ServerApiIterationSyncHive = withApi(
    async (_request, context) => {
        const { id } = await context.params;
        const iteration = await DbIterations.get(id);
        if (!iteration) {
            throw new ClientApiError(`Iteration "${id}" not found!`);
        }

        const hiveCache = await buildHiveCache(iteration.hiveUrl);
        if (!hiveCache) {
            throw new ClientApiError("סנכרון מול ההייב נכשל.");
        }
        return ApiSuccess(await DbIterations.setHiveCache(id, hiveCache));
    },
);
