import { BaseDbDocument } from "@/api-server/curriculum/db-curriculum";
import databaseController from "@/api-server/mongo-db-controller";
import { ClientApiError } from "@/api-shared/errors";
import { ModuleEvent, ModuleEventId } from "@/api-shared/types/curriculum";
import { Filter, FindOptions, InsertOneOptions, FindOneAndUpdateOptions, DeleteOptions } from "mongodb";

async function getModuleEvent(id: ModuleEventId, options?: FindOptions): Promise<(ModuleEvent & BaseDbDocument) | null>
{
    if (!id)
    {
        throw new ClientApiError('ModuleEvent ID is required.');
    }

    const projection: FindOptions[ 'projection' ] = { ...options?.projection, _id: false };
    const document = await databaseController.moduleEvents.findOne({ id }, { ...options, projection });
    return document as (ModuleEvent & BaseDbDocument) | null;
}

async function getMultipleModuleEvents(ids: Array<ModuleEventId>, options?: FindOptions): Promise<Array<ModuleEvent & BaseDbDocument>>
{
    if (!ids || ids.length === 0)
    {
        return [];
    }

    const projection: FindOptions[ 'projection' ] = { ...options?.projection, _id: false };
    const cursor = databaseController.moduleEvents.find({ id: { $in: ids } }, { ...options, projection });
    return cursor.toArray() as Promise<(ModuleEvent & BaseDbDocument)[]>;
}

async function getModuleEventsByFilter(filter: Filter<(ModuleEvent & BaseDbDocument)>, options?: FindOptions): Promise<Array<ModuleEvent & BaseDbDocument>>
{
    const projection: FindOptions[ 'projection' ] = { ...options?.projection, _id: false };
    const cursor = databaseController.moduleEvents.find(filter, { ...options, projection });
    return cursor.toArray() as Promise<(ModuleEvent & BaseDbDocument)[]>;
}

async function createModuleEvent(data: Omit<(ModuleEvent & BaseDbDocument), 'createdAt' | 'updatedAt'>, options?: InsertOneOptions): Promise<(ModuleEvent & BaseDbDocument)>
{
    if (!data.id)
    {
        throw new ClientApiError('ModuleEvent ID is missing! Client must provide a UUID.');
    }

    const now = new Date();
    const newDocument: (ModuleEvent & BaseDbDocument) = {
        ...data,
        createdAt: now,
        updatedAt: now,
    };

    await databaseController.moduleEvents.insertOne(newDocument, options);

    return newDocument;
}

async function updateModuleEvent(id: ModuleEventId, updateData: Partial<Omit<(ModuleEvent & BaseDbDocument), 'id' | 'createdAt'>>, options?: FindOneAndUpdateOptions): Promise<(ModuleEvent & BaseDbDocument)>
{
    if (!id)
    {
        throw new ClientApiError('ModuleEvent ID is required for updates.');
    }

    const updatePayload = {
        ...updateData,
        updatedAt: new Date(),
    };

    // Prevent accidental ID overwrites
    delete (updatePayload as any).id;

    // findOneAndUpdate with returnDocument: 'after' ensures we get the exact DB state post-update atomically
    const projection: FindOptions[ 'projection' ] = { ...options?.projection, _id: false };
    const updatedDocument = await databaseController.moduleEvents.findOneAndUpdate(
        { id },
        { $set: updatePayload },
        { returnDocument: 'after', ...options, projection }
    );

    if (!updatedDocument)
    {
        throw new ClientApiError(`ModuleEvent ${id} not found or update failed.`);
    }

    return updatedDocument as (ModuleEvent & BaseDbDocument);
}

async function deleteModuleEvent(id: ModuleEventId, options?: DeleteOptions): Promise<void>
{
    if (!id)
    {
        throw new ClientApiError('ModuleEvent ID is required for deletion.');
    }

    const result = await databaseController.moduleEvents.deleteOne({ id }, options);

    if (result.deletedCount === 0)
    {
        throw new ClientApiError(`Failed to delete: ModuleEvent ${id} not found.`);
    }
}

async function listModuleEvent(filters?: Filter<(ModuleEvent & BaseDbDocument)>): Promise<Array<ModuleEventId>>
{
    const cursor = databaseController.moduleEvents.find(
        filters ?? {},
        {
            projection: { id: 1, _id: 0 },
            sort: { updatedAt: -1 } // -1 for descending (newest first), 1 for ascending
        }
    );

    const documents = await cursor.toArray();

    // Map over the documents to extract just the IDs and satisfy the return type
    return documents.map(doc => doc.id as ModuleEventId);
}

export const DbModuleEvent = {
    get: getModuleEvent,
    getMultiple: getMultipleModuleEvents,
    getByFilter: getModuleEventsByFilter,
    create: createModuleEvent,
    update: updateModuleEvent,
    delete: deleteModuleEvent,
    list: listModuleEvent,
} as const;
