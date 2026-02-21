import { Setting } from "@/api-shared/types/settings/settings";
import { Period } from "@/components/schedule/types/event";
import { Collection, Db, MongoClient } from "mongodb";
const MONGO_CONNECTION_STRING = process.env.MONGO_CONNECTION_STRING ?? 'mongodb://127.0.0.1:27017/';

class DatabaseController
{
    private mongoClient!: MongoClient;
    private bluezDb!: Db;
    private _periods!: Collection<Period>;
    private _settings!: Collection<Setting>;

    constructor()
    {
        this.mongoClient = new MongoClient(MONGO_CONNECTION_STRING);
        this.bluezDb = this.mongoClient.db('bluez');
        this._periods = this.bluezDb.collection('periods');
        this._settings = this.bluezDb.collection('settings');

    }

    public get periods(): Collection<Period>
    {
        return this._periods;
    }
    public get settings(): Collection<Setting>
    {
        return this._settings;
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
