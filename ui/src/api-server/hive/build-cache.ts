import { createHiveClient } from "@/api-server/hive/session-client";
import {
    HiveCacheChanges,
    HiveIterationCache,
} from "@/api-shared/types/iteration";
import { logger } from "@/logging/pino";

const CACHED_CATEGORIES = ["modules", "subjects", "rooms"] as const;

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
                subjects.map((s) => [s.id, s.name]),
            ),
            rooms: Object.fromEntries(
                rooms.map((r) => [String(r.id), r.name]),
            ),
            cachedAt: new Date().toISOString(),
        };
    } catch (e) {
        logger.error({ err: e }, "Failed to snapshot Hive names for iteration");
        return undefined;
    }
}

/**
 * Summarise what a fresh snapshot changes relative to the stored one, so a
 * manual sync (#379) can report a result instead of succeeding silently. The
 * cache is derived data — never user-edited — so the sync itself is a plain
 * overwrite and this is a report, not a conflict resolution.
 */
export function diffHiveCache(
    before: HiveIterationCache | undefined,
    after: HiveIterationCache,
): HiveCacheChanges {
    const changes: HiveCacheChanges = {
        added: 0,
        removed: 0,
        unchanged: 0,
        updated: 0,
    };
    for (const category of CACHED_CATEGORIES) {
        const previous = before?.[category] ?? {};
        const next = after[category];
        for (const [id, name] of Object.entries(next)) {
            if (!(id in previous)) changes.added += 1;
            else if (previous[id] !== name) changes.updated += 1;
            else changes.unchanged += 1;
        }
        for (const id of Object.keys(previous)) {
            if (!(id in next)) changes.removed += 1;
        }
    }
    return changes;
}
