import { BaseDbDocument } from "@/api-server/curriculum/db-curriculum";
import databaseController from "@/api-server/mongo-db-controller";
import { ClientApiError } from "@/api-shared/errors";
import { Module, ModuleId } from "@/api-shared/types/curriculum";
import { Filter, FindOptions, InsertOneOptions, FindOneAndUpdateOptions, DeleteOptions } from "mongodb";

async function getModule(id: ModuleId, options?: FindOptions): Promise<(Module & BaseDbDocument) | null>
{
    if (!id)
    {
        throw new ClientApiError('Module ID is required.');
    }

    const document = await databaseController.modules.findOne({ id }, options);
    return document as (Module & BaseDbDocument) | null;
}

async function getMultipleModules(ids: Array<ModuleId>, options?: FindOptions): Promise<Array<Module & BaseDbDocument>>
{
    if (!ids || ids.length === 0)
    {
        return [];
    }

    const cursor = databaseController.modules.find({ id: { $in: ids } }, options);
    return cursor.toArray() as Promise<(Module & BaseDbDocument)[]>;
}

async function getModulesByFilter(filter: Filter<(Module & BaseDbDocument)>, options?: FindOptions): Promise<Array<Module & BaseDbDocument>>
{
    const cursor = databaseController.modules.find(filter, options);
    return cursor.toArray() as Promise<(Module & BaseDbDocument)[]>;
}

async function createModule(data: Omit<(Module & BaseDbDocument), 'createdAt' | 'updatedAt'>, options?: InsertOneOptions): Promise<(Module & BaseDbDocument)>
{
    if (!data.id)
    {
        throw new ClientApiError('Module ID is missing! Client must provide a UUID.');
    }

    const now = new Date();
    const newDocument: (Module & BaseDbDocument) = {
        ...data,
        createdAt: now,
        updatedAt: now,
    };

    await databaseController.modules.insertOne(newDocument, options);

    return newDocument;
}

async function updateModule(id: ModuleId, updateData: Partial<Omit<(Module & BaseDbDocument), 'id' | 'createdAt'>>, options?: FindOneAndUpdateOptions): Promise<(Module & BaseDbDocument)>
{
    if (!id)
    {
        throw new ClientApiError('Module ID is required for updates.');
    }

    const updatePayload = {
        ...updateData,
        updatedAt: new Date(),
    };

    // Prevent accidental ID overwrites
    delete (updatePayload as any).id;

    // findOneAndUpdate with returnDocument: 'after' ensures we get the exact DB state post-update atomically
    const updatedDocument = await databaseController.modules.findOneAndUpdate(
        { id },
        { $set: updatePayload },
        { returnDocument: 'after', ...options }
    );

    if (!updatedDocument)
    {
        throw new ClientApiError(`Module ${id} not found or update failed.`);
    }

    return updatedDocument as (Module & BaseDbDocument);
}

async function deleteModule(id: ModuleId, options?: DeleteOptions): Promise<void>
{
    if (!id)
    {
        throw new ClientApiError('Module ID is required for deletion.');
    }

    const result = await databaseController.modules.deleteOne({ id }, options);

    if (result.deletedCount === 0)
    {
        throw new ClientApiError(`Failed to delete: Module ${id} not found.`);
    }
}

async function listModule(filters?: Filter<(Module & BaseDbDocument)>): Promise<Array<ModuleId>>
{
    const cursor = databaseController.modules.find(
        filters ?? {},
        {
            projection: { id: 1, _id: 0 },
            sort: { updatedAt: -1 } // -1 for descending (newest first), 1 for ascending
        }
    );

    const documents = await cursor.toArray();

    // Map over the documents to extract just the IDs and satisfy the return type
    return documents.map(doc => doc.id as ModuleId);
}

export const DbModule = {
    get: getModule,
    getMultiple: getMultipleModules,
    getByFilter: getModulesByFilter,
    create: createModule,
    update: updateModule,
    delete: deleteModule,
    list: listModule,
} as const;
