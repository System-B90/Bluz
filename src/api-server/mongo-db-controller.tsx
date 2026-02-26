import { Course } from "@/api-shared/types/course";
import { Setting } from "@/api-shared/types/settings/settings";
import { Event } from "@/components/schedule/types/event";
import { CustomRoom } from "@/components/schedule/types/room";
import { Collection, Db, MongoClient } from "mongodb";
const MONGO_CONNECTION_STRING = process.env.MONGO_CONNECTION_STRING ?? 'mongodb://127.0.0.1:27017/';

class DatabaseController
{
    private mongoClient!: MongoClient;
    private bluzDb!: Db;
    private _events!: Collection<Event>;
    private _settings!: Collection<Setting>;
    private _courses!: Collection<Course>;
    private _rooms!: Collection<CustomRoom>;

    constructor()
    {
        this.mongoClient = new MongoClient(MONGO_CONNECTION_STRING);
        this.bluzDb = this.mongoClient.db('bluz');
        this._events = this.bluzDb.collection('events');
        this._settings = this.bluzDb.collection('settings');
        this._courses = this.bluzDb.collection('courses');
        this._rooms = this.bluzDb.collection('rooms');

    }

    public get events(): Collection<Event>
    {
        return this._events;
    }
    public get settings(): Collection<Setting>
    {
        return this._settings;
    }
    public get courses(): Collection<Course>
    {
        return this._courses;
    }
    public get rooms(): Collection<CustomRoom>
    {
        return this._rooms;
    }
}

const databaseController = new DatabaseController();
export default databaseController;


export type ProjectionMap<T> = {
    [ P in keyof T ]: 1;
};

export function createProjectionMap<T extends object>(keys: (keyof T)[]): ProjectionMap<T>
{
    const map: any = {};

    keys.forEach((key) =>
    {
        map[ key ] = 1;
    });

    return map;
}
