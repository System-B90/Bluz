import { Collection, Db, MongoClient } from "mongodb";

import { DbEventDocument } from "@/api-server/db-event";
import { BaseDbDocument } from "@/api-server/gantt/db-base";
import { Course } from "@/api-shared/types/course";
import
{
    GanttCurriculum,
    GanttEvent,
    GanttModule,
    GanttSyllabus,
} from "@/api-shared/types/gantt/models";
import { Setting } from "@/api-shared/types/settings/settings";
import { CustomRoom } from "@/components/schedule/types/room";

const MONGO_CONNECTION_STRING =
  process.env.MONGO_CONNECTION_STRING ?? "mongodb://127.0.0.1:27017/";

class DatabaseController {
    private mongoClient!: MongoClient;
    private bluzDb!: Db;
    private _events!: Collection<DbEventDocument>;
    private _settings!: Collection<Setting>;
    private _courses!: Collection<Course>;
    private _rooms!: Collection<CustomRoom>;
    private _curriculums!: Collection<GanttCurriculum & BaseDbDocument>;
    private _syllabuses!: Collection<GanttSyllabus & BaseDbDocument>;
    private _modules!: Collection<GanttModule & BaseDbDocument>;
    private _moduleEvents!: Collection<GanttEvent & BaseDbDocument>;

    constructor() {
        this.mongoClient = new MongoClient(MONGO_CONNECTION_STRING);
        this.bluzDb = this.mongoClient.db("bluz");
        this._events = this.bluzDb.collection("events");
        this._settings = this.bluzDb.collection("settings");
        this._courses = this.bluzDb.collection("courses");
        this._rooms = this.bluzDb.collection("rooms");
        this._curriculums = this.bluzDb.collection("curriculums");
        this._syllabuses = this.bluzDb.collection("syllabuses");
        this._modules = this.bluzDb.collection("modules");
        this._moduleEvents = this.bluzDb.collection("moduleEvents");
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
}

const databaseController = new DatabaseController();
export { databaseController };

export type ProjectionMap<T> = {
  [P in keyof T]: 1;
};

export function createProjectionMap<T extends object>(
    keys: (keyof T)[],
): ProjectionMap<T> {
    const map: any = {};

    keys.forEach((key) => {
        map[key] = 1;
    });

    return map;
}
