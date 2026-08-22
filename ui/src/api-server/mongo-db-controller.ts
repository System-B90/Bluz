import { Collection, Db, MongoClient } from "mongodb";

import { DbEventDocument } from "@/api-server/db-event";
import { BaseDbDocument } from "@/api-server/gantt/db-base";
import { ClientApiError } from "@/api-shared/errors";
import { CalendarDraft, CalendarSnapshot } from "@/api-shared/types";
import { Course } from "@/api-shared/types/course";
import { CurriculumCutClaim } from "@/api-shared/types/curriculum-cut";
import { CustomColor } from "@/api-shared/types/custom-color";
import { EventHistoryEntry } from "@/api-shared/types/event-history";
import {
    GanttCurriculum,
    GanttEvent,
    GanttModule,
    GanttSyllabus,
} from "@/api-shared/types/gantt/models";
import { GoogleCalendarLink } from "@/api-shared/types/google-calendar";
import { HiveLessonActivation } from "@/api-shared/types/hive-activation";
import { Iteration, IterationId } from "@/api-shared/types/iteration";
import { Outsider } from "@/api-shared/types/outsider";
import { PersonalSettings } from "@/api-shared/types/personal-settings";
import { DbReservation } from "@/api-shared/types/reservation";
import {
    CustomRoom,
    RoomExtendedInfo,
    RoomId,
    RoomSource,
} from "@/api-shared/types/room";
import { Setting } from "@/api-shared/types/settings/settings";

export type RoomExtendedInfoDocument = RoomExtendedInfo & {
    roomId: RoomId;
    roomSource: RoomSource;
};

const MONGO_CONNECTION_STRING =
    process.env.MONGO_CONNECTION_STRING ?? "mongodb://127.0.0.1:27017/";

/** Database backing the first / default iteration (the existing data). */
export const DEFAULT_ITERATION_DB_NAME = process.env.MONGO_DB_NAME ?? "bluz";

/** Shared meta database that holds the registry of all iterations. */
export const META_DB_NAME = process.env.MONGO_META_DB_NAME ?? "bluz_meta";

function readIntEnv(name: string, fallback: number): number {
    const parsed = Number.parseInt(process.env[name] ?? "", 10);
    return Number.isNaN(parsed) ? fallback : parsed;
}

// A single MongoClient is shared across every iteration. `client.db(name)`
// handles are cheap, so we create one controller per database name on demand.
// The client is cached on globalThis so Next.js dev hot-reload reuses the pool
// instead of leaking a new connection pool on every module re-evaluation.
const globalCache = globalThis as unknown as { __bluzMongoClient?: MongoClient };

function createMongoClient(): MongoClient {
    return new MongoClient(MONGO_CONNECTION_STRING, {
        maxPoolSize: readIntEnv("MONGO_MAX_POOL_SIZE", 50),
        minPoolSize: readIntEnv("MONGO_MIN_POOL_SIZE", 0),
        maxIdleTimeMS: readIntEnv("MONGO_MAX_IDLE_TIME_MS", 60_000),
    });
}

let mongoClient = globalCache.__bluzMongoClient ?? createMongoClient();

if (process.env.NODE_ENV !== "production") {
    globalCache.__bluzMongoClient = mongoClient;
}

/**
 * The live client — never hold on to the result.
 *
 * A MongoClient whose *first* connection attempt fails closes its topology,
 * and the driver does not reopen it: every later operation throws
 * "MongoTopologyClosedError: Topology is closed", forever. In a container that
 * boots beside its database, that first attempt regularly happens while Mongo
 * is still starting, so the app came up permanently unable to reach Mongo
 * while looking otherwise fine — only /api/health caught it.
 *
 * Replacing the closed client here makes the app recover by itself once Mongo
 * is up. Handles derived from it (`db()`, `collection()`) are bound to the
 * client that produced them, which is why the controller resolves them per
 * access rather than caching them in the constructor.
 */
function getMongoClient(): MongoClient {
    // `topology` is undefined before the first connect and carries an
    // `isDestroyed()` once one has happened.
    const topology = (
        mongoClient as unknown as {
            topology?: { isDestroyed?: () => boolean };
        }
    ).topology;

    if (topology?.isDestroyed?.()) {
        mongoClient = createMongoClient();
        if (process.env.NODE_ENV !== "production") {
            globalCache.__bluzMongoClient = mongoClient;
        }
    }

    return mongoClient;
}

class DatabaseController {
    public readonly dbName: string;

    constructor(dbName: string = DEFAULT_ITERATION_DB_NAME) {
        this.dbName = dbName;
    }

    // Resolved per access rather than cached in the constructor: a handle is
    // bound to the client that created it, so a controller built while Mongo
    // was unreachable would keep serving handles from the dead client for the
    // life of the process. `db()`/`collection()` are cheap wrappers.
    private get bluzDb(): Db {
        return getMongoClient().db(this.dbName);
    }

    public get events(): Collection<DbEventDocument> {
        return this.bluzDb.collection("events");
    }
    /**
     * Append-only change log for events. Rows reference events by id and never
     * copy event state, so the events collection stays free of audit columns.
     */
    public get eventHistory(): Collection<EventHistoryEntry> {
        return this.bluzDb.collection("eventHistory");
    }
    public get settings(): Collection<Setting> {
        return this.bluzDb.collection("settings");
    }
    public get courses(): Collection<Course> {
        return this.bluzDb.collection("courses");
    }
    public get rooms(): Collection<CustomRoom> {
        return this.bluzDb.collection("rooms");
    }
    public get curriculums(): Collection<GanttCurriculum & BaseDbDocument> {
        return this.bluzDb.collection("curriculums");
    }
    public get syllabuses(): Collection<GanttSyllabus & BaseDbDocument> {
        return this.bluzDb.collection("syllabuses");
    }
    public get modules(): Collection<GanttModule & BaseDbDocument> {
        return this.bluzDb.collection("modules");
    }
    public get moduleEvents(): Collection<GanttEvent & BaseDbDocument> {
        return this.bluzDb.collection("moduleEvents");
    }
    public get roomExtendedInfo(): Collection<RoomExtendedInfoDocument> {
        return this.bluzDb.collection("roomExtendedInfo");
    }
    public get outsiders(): Collection<Outsider> {
        return this.bluzDb.collection("outsiders");
    }
    public get reservations(): Collection<DbReservation> {
        return this.bluzDb.collection("reservations");
    }
    public get calendarSnapshots(): Collection<CalendarSnapshot> {
        return this.bluzDb.collection("calendarSnapshots");
    }
    public get calendarDrafts(): Collection<CalendarDraft> {
        return this.bluzDb.collection("calendarDrafts");
    }
    /**
     * Ledger of Hive queue openings: one row per (event, occurrence, student
     * group) that the activator has already pushed to Hive. Its unique index
     * is what makes the activator idempotent and safe to run in more than one
     * replica — the insert, not a lock, decides who acts.
     */
    public get hiveLessonActivations(): Collection<HiveLessonActivation> {
        return this.bluzDb.collection("hiveLessonActivations");
    }
    /**
     * Claims of the one-shot curriculum cut. Like the activation ledger above,
     * the unique index is the concurrency control — an unlocked
     * check-then-insert let two concurrent cuts both pass the guard and each
     * insert the whole schedule (#515).
     */
    public get curriculumCuts(): Collection<CurriculumCutClaim> {
        return this.bluzDb.collection("curriculumCuts");
    }
    public get client(): MongoClient {
        return getMongoClient();
    }
}

export { DatabaseController };

// Indexes backing the hot query paths. Created lazily (once per database, per
// process) in the background — createIndex is idempotent so racing processes
// are safe, and a failure only costs query speed, never correctness.
const indexedDbNames = new Set<string>();

function ensureIndexesInBackground(controller: DatabaseController): void {
    // Unit tests run without Mongo; skip so vitest never waits on connect retries.
    if (process.env.VITEST) return;
    if (indexedDbNames.has(controller.dbName)) return;
    indexedDbNames.add(controller.dbName);

    void Promise.allSettled([
        // Every event read/update path filters on the client-generated `id`,
        // and `id` is the document's real identity: creates blind-insert a
        // client-generated UUID, so without uniqueness two concurrent PUTs of
        // the same id produced two documents and every later read/update
        // silently picked an arbitrary copy (#514).
        //
        // On a database that already holds duplicates this createIndex fails —
        // as does the case where the old non-unique `{ id: 1 }` index is still
        // present (IndexOptionsConflict). Both are logged below; the fix is to
        // de-duplicate and drop the stale index once, not to weaken this.
        controller.events.createIndex({ id: 1 }, { unique: true }),
        // Calendar views fetch by date window (getDbEventsInRange).
        controller.events.createIndex({ startTime: 1, endTime: 1 }),
        // Snapshot listing sorts newest-first.
        controller.calendarSnapshots.createIndex({ createdAt: -1 }),
        // History is always read per event, newest-first.
        controller.eventHistory.createIndex({ eventId: 1, changedAt: -1 }),
        // The activation ledger's uniqueness *is* the concurrency control for
        // opening queues — without it two replicas could both assign, and a
        // restart could re-assign a class that already moved on.
        controller.hiveLessonActivations.createIndex(
            { eventId: 1, hiveClassId: 1, occurrenceStart: 1 },
            { unique: true },
        ),
        // A row only has to outlive the occurrence it guards, which the
        // activator caps at ten minutes. A week is a generous audit trail and
        // keeps the ledger from growing without bound.
        controller.hiveLessonActivations.createIndex(
            { activatedAt: 1 },
            { expireAfterSeconds: 7 * 24 * 60 * 60 },
        ),
        // The cut claim's uniqueness is what makes a cut one-shot under
        // concurrency (#515).
        controller.curriculumCuts.createIndex(
            { curriculumId: 1 },
            { unique: true },
        ),
    ]).then((results) => {
        // allSettled, not all: one failing index must not skip the rest.
        for (const result of results) {
            if (result.status === "rejected") {
                console.error(
                    `Failed to ensure a Mongo index on "${controller.dbName}"`,
                    result.reason,
                );
            }
        }
    });
}

// One controller per database name. `.db()` handles are cheap so the cost here
// is just the small per-database collection wrappers.
const controllerCache = new Map<string, DatabaseController>();

/**
 * Resolve (and cache) the controller for a specific iteration database.
 * @param dbName Mongo database backing the iteration.
 */
export function getDatabaseController(
    dbName: string = DEFAULT_ITERATION_DB_NAME,
): DatabaseController {
    let controller = controllerCache.get(dbName);
    if (!controller) {
        controller = new DatabaseController(dbName);
        controllerCache.set(dbName, controller);
        ensureIndexesInBackground(controller);
    }
    return controller;
}

/**
 * Back-compat shim: the controller for the default iteration's database. Existing
 * code that imports `databaseController` keeps working unchanged.
 */
const databaseController = getDatabaseController(DEFAULT_ITERATION_DB_NAME);
export { databaseController };

/** Lightweight controller over the shared `bluz_meta` database. */
class MetaController {
    // Same reason as DatabaseController: never cache a handle from a client
    // that may have closed its topology.
    private get metaDb(): Db {
        return getMongoClient().db(META_DB_NAME);
    }
    public get iterations(): Collection<Iteration> {
        return this.metaDb.collection<Iteration>("iterations");
    }
    /** Per-user personal settings (favorites etc.), shared across all iterations. */
    public get personalSettings(): Collection<PersonalSettingsDocument> {
        return this.metaDb.collection<PersonalSettingsDocument>(
            "personalSettings",
        );
    }
    public get customColors(): Collection<CustomColor> {
        return this.metaDb.collection<CustomColor>("customColors");
    }
    /** Per-user Google Calendar OAuth links (opt-in), shared across all iterations. */
    public get googleCalendarLinks(): Collection<GoogleCalendarLink> {
        return this.metaDb.collection<GoogleCalendarLink>(
            "googleCalendarLinks",
        );
    }
    public get client(): MongoClient {
        // Never the module-level handle: if the first connect failed, that one
        // is a closed topology forever, and `client.startSession()` throws.
        return getMongoClient();
    }
}

export type PersonalSettingsDocument = PersonalSettings & { userId: string };

let _metaController: MetaController | null = null;
export function getMetaController(): MetaController {
    if (!_metaController) {
        _metaController = new MetaController();
        if (!process.env.VITEST) {
            // The registry is consulted on every iteration-scoped request.
            void Promise.all([
                _metaController.iterations.createIndex({ id: 1 }),
                _metaController.iterations.createIndex({ isCurrent: 1 }),
                _metaController.googleCalendarLinks.createIndex(
                    { userId: 1 },
                    { unique: true },
                ),
            ]).catch((error) => {
                console.error("Failed to ensure iteration registry indexes", error);
            });
        }
    }
    return _metaController;
}

// The writable "current" iteration's database. Defaults to the migrated `bluz`
// DB and is updated in-process when an admin switches the current iteration.
let _currentIterationDbName: string = DEFAULT_ITERATION_DB_NAME;

// Cold start / serverless safety: the in-process default can be stale if the
// current iteration was switched to a custom database — by a previous process,
// or, once Bluz is scaled horizontally, by a sibling replica that is serving
// right now. `setCurrentIterationDbName` only mutates the local process, so a
// permanently memoized probe left every other replica *writing* to the previous
// iteration's database until it restarted (#513). The probe is therefore
// memoized for at most CURRENT_ITERATION_MEMO_TTL_MS: still off the hot path
// for a burst of requests, but self-healing within a few seconds.
const CURRENT_ITERATION_MEMO_TTL_MS = 15_000;
let _currentInitPromise: null | Promise<void> = null;
let _currentInitAt = 0;

async function ensureCurrentIterationResolved(): Promise<void> {
    // Unit tests run without Mongo; the registry is mocked where it matters, so
    // skip the probe to keep the default fast and deterministic.
    if (process.env.VITEST) return;
    if (
        _currentInitPromise &&
        Date.now() - _currentInitAt < CURRENT_ITERATION_MEMO_TTL_MS
    ) {
        return await _currentInitPromise;
    }
    let failed = false;
    const probe: Promise<void> = (async () => {
        try {
            const current = await getMetaController().iterations.findOne({
                isCurrent: true,
            });
            if (current?.dbName) {
                _currentIterationDbName = current.dbName;
            }
        } catch {
            // Registry unreachable or unseeded — keep the default database for
            // now, but do not let a one-off failure pin the process to it.
            failed = true;
        }
    })();
    _currentInitPromise = probe;
    _currentInitAt = Date.now();
    await probe;
    // Clear the memo so the next request probes again. An explicit switch that
    // landed meanwhile owns the memo, so only drop it if it is still ours.
    if (failed && _currentInitPromise === probe) {
        _currentInitPromise = null;
        _currentInitAt = 0;
    }
}

/** Update the cached current-iteration database (called after a setCurrent). */
export function setCurrentIterationDbName(dbName: string) {
    _currentIterationDbName = dbName;
    // A subsequent registry probe must not clobber an explicit switch — but the
    // TTL still applies, so a switch made by another replica is picked up.
    _currentInitPromise = Promise.resolve();
    _currentInitAt = Date.now();
}

/** The database name backing the current (writable) iteration. */
export function getCurrentIterationDbName(): string {
    return _currentIterationDbName;
}

/**
 * Resolve the controller for a given iteration. When `iterationId` is omitted the
 * current iteration is used (backward compatible with single-iteration callers).
 * The current iteration is resolved from the registry once per process (cold
 * start safe); an explicit iteration id always triggers a registry lookup.
 */
export async function resolveIterationDb(
    iterationId?: IterationId,
): Promise<DatabaseController> {
    return await lookupIterationDb(iterationId, false);
}

/**
 * Like {@link resolveIterationDb} but also rejects past (non-current) iterations.
 * Avoids the double Mongo lookup of calling resolveIterationDb + assertWritable separately.
 */
export async function resolveWritableIterationDb(
    iterationId?: IterationId,
): Promise<DatabaseController> {
    return await lookupIterationDb(iterationId, true);
}

/** Single registry lookup behind both iteration resolvers. */
async function lookupIterationDb(
    iterationId: IterationId | undefined,
    writable: boolean,
): Promise<DatabaseController> {
    if (!iterationId) {
        await ensureCurrentIterationResolved();
        return getDatabaseController(_currentIterationDbName);
    }

    const iteration = await getMetaController().iterations.findOne({
        id: iterationId,
    });
    if (!iteration) {
        throw new ClientApiError(`Unknown iteration "${iterationId}"`);
    }
    if (writable && !iteration.isCurrent) {
        throw new ClientApiError(
            "מחזור קודם הוא לקריאה בלבד ולא ניתן לעריכה",
        );
    }
    return getDatabaseController(iteration.dbName);
}

export type ProjectionMap<T> = {
    [P in keyof T]: 1;
};

export function createProjectionMap<T extends object>(
    keys: Array<keyof T>,
): ProjectionMap<T> {
    const map: any = {};

    keys.forEach((key) => {
        map[key] = 1;
    });

    return map;
}
