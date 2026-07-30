/**
 * Name: iteration.ts
 * Purpose: Shared type for a course iteration (a bi-annual run / "Luz").
 *          Each iteration is backed by its own MongoDB database; the registry
 *          of all iterations lives in a dedicated `bluz_meta` database.
 * Created: 2026-06-27
 * Author: Michael K. Steinberg
 */

export type IterationId = string;

/**
 * Query-string key carrying the active iteration id. Lives here rather than in
 * `api-server` so the browser can build the same URLs the routes parse.
 */
export const ITERATION_QUERY_PARAM = "it";

/**
 * Snapshot of Hive names taken when an iteration is created. The Hive instance
 * changes every iteration, so numeric Hive ids are not stable across runs — we
 * cache the human names by id so a past iteration can be displayed even after
 * its Hive instance is gone or its ids have been reused.
 */
export type HiveIterationCache = {
    /** Hive module id → module name. */
    modules: Record<string, string>;
    /** Hive subject id → subject display name. */
    subjects: Record<string, string>;
    /** Hive room id → room name. */
    rooms: Record<string, string>;
    /** When this snapshot was taken (ISO string). */
    cachedAt: string;
};

/**
 * How a manual "sync Hive info" (#379) changed the cached names. Counts are
 * summed across modules, subjects and rooms.
 */
export type HiveCacheChanges = {
    /** Ids present in Hive that the cache did not have. */
    added: number;
    /** Ids whose cached name differs from Hive's. */
    updated: number;
    /** Cached ids that Hive no longer returns. */
    removed: number;
    /** Ids whose cached name already matched. */
    unchanged: number;
};

/** Response of `POST /api/iterations/[id]/sync-hive`. */
export type SyncHiveResult = {
    iteration: Iteration;
    changes: HiveCacheChanges;
};

/**
 * A single course iteration (bi-annual run). The set of all iterations is
 * stored in the shared `bluz_meta` DB; the calendar data for each iteration
 * lives in the database named by `dbName`.
 */
export type Iteration = {
    /** Stable id, e.g. "2026a". */
    id: IterationId;
    /** Human label, e.g. "מחזור 2026 א'". */
    label: string;
    /** Mongo DB backing this iteration ("bluz", "bluz_2026b", ...). */
    dbName: string;
    /** Per-iteration Hive instance base URL (the Hive instance changes each run). */
    hiveUrl?: string;
    /** Cached Hive names, snapshotted at creation time. */
    hiveCache?: HiveIterationCache;
    startDate: Date | string;
    endDate: Date | null | string;
    /** Exactly one iteration is current → the writable / active run. */
    isCurrent: boolean;
    /** Optional link to the Postgres curriculum that drove this iteration. */
    ganttCurriculumId?: string;
    createdAt: Date | string;
    updatedAt: Date | string;
};

/** Payload to register a new iteration. `dbName` is derived from `id` when omitted. */
export type RegisterIterationPayload = {
    id: IterationId;
    label: string;
    dbName?: string;
    hiveUrl?: string;
    /** Optional pre-computed Hive name cache (the route fills this in). */
    hiveCache?: HiveIterationCache;
    startDate?: Date | string;
    endDate?: Date | null | string;
    ganttCurriculumId?: string;
};

/** Mutable fields of an iteration via PATCH. */
export type PatchIterationPayload = {
    label?: string;
    hiveUrl?: string;
    endDate?: Date | null | string;
    isCurrent?: boolean;
    /** Pass null to unlink the curriculum. */
    ganttCurriculumId?: null | string;
};
