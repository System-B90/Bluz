import { Collection, Db, MongoClient } from "mongodb";

import { DbEventDocument } from "@/api-server/db-event";
import { BaseDbDocument } from "@/api-server/gantt/db-base";
import { ClientApiError } from "@/api-shared/errors";
import { CalendarSnapshot } from "@/api-shared/types";
import { Course } from "@/api-shared/types/course";
import {
    GanttCurriculum,
    GanttEvent,
    GanttModule,
    GanttSyllabus,
} from "@/api-shared/types/gantt/models";
import { Iteration, IterationId } from "@/api-shared/types/iteration";
import { Outsider } from "@/api-shared/types/outsider";
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

// A single MongoClient is shared across every iteration. `client.db(name)`
// handles are cheap, so we create one controller per database name on demand.
const mongoClient = new MongoClient(MONGO_CONNECTION_STRING);

class DatabaseController {
    private mongoClient: MongoClient;
    private bluzDb: Db;
    private _events: Collection<DbEventDocument>;
    private _settings: Collection<Setting>;
    private _courses: Collection<Course>;
    private _rooms: Collection<CustomRoom>;
    private _curriculums: Collection<GanttCurriculum & BaseDbDocument>;
    private _syllabuses: Collection<GanttSyllabus & BaseDbDocument>;
    private _modules: Collection<GanttModule & BaseDbDocument>;
    private _moduleEvents: Collection<GanttEvent & BaseDbDocument>;
    private _roomExtendedInfo: Collection<RoomExtendedInfoDocument>;
    private _outsiders: Collection<Outsider>;
    private _reservations: Collection<DbReservation>;
    private _calendarSnapshots: Collection<CalendarSnapshot>;
    public readonly dbName: string;

    constructor(dbName: string = DEFAULT_ITERATION_DB_NAME) {
        this.dbName = dbName;
        this.mongoClient = mongoClient;
        this.bluzDb = this.mongoClient.db(dbName);
        this._events = this.bluzDb.collection("events");
        this._settings = this.bluzDb.collection("settings");
        this._courses = this.bluzDb.collection("courses");
        this._rooms = this.bluzDb.collection("rooms");
        this._curriculums = this.bluzDb.collection("curriculums");
        this._syllabuses = this.bluzDb.collection("syllabuses");
        this._modules = this.bluzDb.collection("modules");
        this._moduleEvents = this.bluzDb.collection("moduleEvents");
        this._roomExtendedInfo = this.bluzDb.collection("roomExtendedInfo");
        this._outsiders = this.bluzDb.collection("outsiders");
        this._reservations = this.bluzDb.collection("reservations");
        this._calendarSnapshots =
            this.bluzDb.collection("calendarSnapshots");
    }

    public get events(): Collection<DbEventDocument> {
        return this._events;
    }
    public get settings(): Collection<Setting> {
        return this._settings;
    }
    public get courses(): Collection<Course> {
        return this._courses;
    }
    public get rooms(): Collection<CustomRoom> {
        return this._rooms;
    }
    public get curriculums() {
        return this._curriculums;
    }
    public get syllabuses() {
        return this._syllabuses;
    }
    public get modules() {
        return this._modules;
    }
    public get moduleEvents() {
        return this._moduleEvents;
    }
    public get roomExtendedInfo(): Collection<RoomExtendedInfoDocument> {
        return this._roomExtendedInfo;
    }
    public get outsiders(): Collection<Outsider> {
        return this._outsiders;
    }
    public get reservations(): Collection<DbReservation> {
        return this._reservations;
    }
    public get calendarSnapshots(): Collection<CalendarSnapshot> {
        return this._calendarSnapshots;
    }
    public get client(): MongoClient {
        return this.mongoClient;
    }
}

export { DatabaseController };

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
    private readonly metaDb: Db;
    constructor() {
        this.metaDb = mongoClient.db(META_DB_NAME);
    }
    public get iterations(): Collection<Iteration> {
        return this.metaDb.collection<Iteration>("iterations");
    }
    public get client(): MongoClient {
        return mongoClient;
    }
}

let _metaController: MetaController | null = null;
export function getMetaController(): MetaController {
    if (!_metaController) {
        _metaController = new MetaController();
    }
    return _metaController;
}

// The writable "current" iteration's database. Defaults to the migrated `bluz`
// DB and is updated in-process when an admin switches the current iteration.
let _currentIterationDbName: string = DEFAULT_ITERATION_DB_NAME;

// Cold start / serverless safety: the in-process default can be stale if the
// current iteration was switched to a custom database in a previous process.
// On the first default resolve we read `isCurrent` from the registry exactly
// once and memoize the promise, so subsequent calls stay off the hot path.
let _currentInitPromise: null | Promise<void> = null;

async function ensureCurrentIterationResolved(): Promise<void> {
    // Unit tests run without Mongo; the registry is mocked where it matters, so
    // skip the probe to keep the default fast and deterministic.
    if (process.env.VITEST) return;
    if (_currentInitPromise) return await _currentInitPromise;
    _currentInitPromise = (async () => {
        try {
            const current = await getMetaController().iterations.findOne({
                isCurrent: true,
            });
            if (current?.dbName) {
                _currentIterationDbName = current.dbName;
            }
        } catch {
            // Registry unreachable or unseeded — keep the default database.
        }
    })();
    return await _currentInitPromise;
}

/** Update the cached current-iteration database (called after a setCurrent). */
export function setCurrentIterationDbName(dbName: string) {
    _currentIterationDbName = dbName;
    // A subsequent registry probe must not clobber an explicit switch.
    _currentInitPromise = Promise.resolve();
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
    return getDatabaseController(iteration.dbName);
}

/**
 * Like {@link resolveIterationDb} but also rejects past (non-current) iterations.
 * Avoids the double Mongo lookup of calling resolveIterationDb + assertWritable separately.
 */
export async function resolveWritableIterationDb(
    iterationId?: IterationId,
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
    if (!iteration.isCurrent) {
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
