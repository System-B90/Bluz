export const dynamic = "force-dynamic";

import { ApiSuccess, catchHandler, ServerApi } from "@/api-server/common";
import { DbIterations } from "@/api-server/db-iterations";
import { createHiveClient } from "@/api-server/hive/session-client";
import { ClientApiError } from "@/api-shared/errors";
import {
    HiveIterationCache,
    Iteration,
    RegisterIterationPayload,
} from "@/api-shared/types/iteration";

/**
 * Snapshot the Hive module / subject / room names for an iteration's Hive
 * instance. Hive ids are not stable across iterations, so we freeze the names by
 * id at creation time. Best-effort: a Hive failure must not block registration.
 */
async function buildHiveCache(
    hiveUrl?: string,
): Promise<HiveIterationCache | undefined> {
    try {
        const hive = await createHiveClient(hiveUrl);
        const [modules, subjects, rooms] = await Promise.all([
            hive.getModules(),
            hive.getSubjects(),
            hive.getRooms(),
        ]);
        return {
            modules: Object.fromEntries(modules.map((m) => [m.id, m.name])),
            subjects: Object.fromEntries(
                subjects.map((s) => [s.id, s.displayName || s.name]),
            ),
            rooms: Object.fromEntries(
                rooms.map((r) => [String(r.id), r.name]),
            ),
            cachedAt: new Date().toISOString(),
        };
    } catch (e) {
        console.error("Failed to snapshot Hive names for iteration", e);
        return undefined;
    }
}

type ServerApiIterationsList = ServerApi<void, Array<Iteration>>;
type ServerApiIterationRegister = ServerApi<
    RegisterIterationPayload,
    Iteration
>;

export const GET: ServerApiIterationsList = async (request) => {
    try {
        return ApiSuccess(await DbIterations.list());
    } catch (e) {
        return catchHandler(request, e);
    }
};

export const POST: ServerApiIterationRegister = async (request) => {
    try {
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
    } catch (e) {
        return catchHandler(request, e);
    }
};
