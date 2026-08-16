export const dynamic = "force-dynamic";

import {
    ApiSuccess,
    ServerApiWithParams,
    withApi,
} from "@/api-server/common";
import { DbIterations } from "@/api-server/db-iterations";
import { buildHiveCache, diffHiveCache } from "@/api-server/hive/build-cache";
import { requireStaffSession } from "@/api-server/session-user";
import { ClientApiError } from "@/api-shared/errors";
import { SyncHiveResult } from "@/api-shared/types/iteration";

type ServerApiIterationSyncHive = ServerApiWithParams<
    void,
    SyncHiveResult,
    { id: string }
>;

/**
 * Manually re-snapshot the Hive module/subject/room names for an iteration
 * (#379), rather than relying only on the snapshot taken at creation time.
 *
 * Past iterations are rejected by the same read-only guard as every other
 * write: their snapshot is what keeps them readable once their Hive instance
 * is gone, and Hive ids are reused across runs, so re-syncing one would
 * overwrite history with a different Hive's names.
 */
export const POST: ServerApiIterationSyncHive = withApi(
    async (_request, context) => {
        await requireStaffSession();
        const { id } = await context.params;
        await DbIterations.assertWritable(id);

        const iteration = await DbIterations.get(id);
        if (!iteration) {
            throw new ClientApiError(`Iteration "${id}" not found!`);
        }
        if (!iteration.hiveUrl) {
            throw new ClientApiError("למחזור לא מוגדרת כתובת הייב.");
        }

        const hiveCache = await buildHiveCache(iteration.hiveUrl);
        if (!hiveCache) {
            throw new ClientApiError("סנכרון מול ההייב נכשל.");
        }
        return ApiSuccess({
            changes: diffHiveCache(iteration.hiveCache, hiveCache),
            iteration: await DbIterations.setHiveCache(id, hiveCache),
        });
    },
);
