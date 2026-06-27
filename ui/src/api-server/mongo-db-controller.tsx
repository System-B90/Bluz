import { Collection, Db, MongoClient } from "mongodb";

import { DbEventDocument } from "@/api-server/db-event";
import { BaseDbDocument } from "@/api-server/gantt/db-base";
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
// DB and is updated in-process when an admin switches the current iteration. We
// deliberately keep this off the per-request hot path (no Mongo round-trip) so
// the common single-iteration case stays fast and side-effect free.
let _currentIterationDbName: string = DEFAULT_ITERATION_DB_NAME;

/** Update the cached current-iteration database (called after a setCurrent). */
export function setCurrentIterationDbName(dbName: string) {
    _currentIterationDbName = dbName;
}

/** The database name backing the current (writable) iteration. */
export function getCurrentIterationDbName(): string {
    return _currentIterationDbName;
}

/**
 * Resolve the controller for a given iteration. When `iterationId` is omitted the
 * current iteration is used (backward compatible with single-iteration callers).
 * Only an explicit iteration id triggers a registry (Mongo) lookup.
 */
export async function resolveIterationDb(
    iterationId?: IterationId,
): Promise<DatabaseController> {
    if (!iterationId) {
        return getDatabaseController(_currentIterationDbName);
    }

    const iteration = await getMetaController().iterations.findOne({
        id: iterationId,
    });
    if (!iteration) {
        throw new Error(`Unknown iteration "${iterationId}"`);
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
