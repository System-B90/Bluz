import { createHiveClient } from "@/api-server/hive/session-client";
import { HiveIterationCache } from "@/api-shared/types/iteration";

/**
 * Snapshot the Hive module / subject / room names for a Hive instance. Hive
 * ids are not stable across iterations, so we freeze the names by id.
 * Best-effort: a Hive failure must not block the caller.
 */
export async function buildHiveCache(
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
