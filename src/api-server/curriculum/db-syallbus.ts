import databaseController from "@/api-server/mongo-db-controller";
import { ClientApiError } from "@/api-shared/errors";
import { CurriculumId, ModuleId, Syllabus, SyllabusId } from "@/api-shared/types/curriculum";
import { Filter, FindOptions, InsertOneOptions, FindOneAndUpdateOptions, DeleteOptions } from "mongodb";

export type DbSyllabusDocument = Syllabus & {
    createdAt: Date;
    updatedAt: Date;
};

async function getSyllabus(id: SyllabusId, options?: FindOptions): Promise<DbSyllabusDocument | null>
{
    if (!id)
    {
        throw new ClientApiError('Syllabus ID is required.');
    }

    const projection: FindOptions[ 'projection' ] = { ...options?.projection, _id: false };
    const document = await databaseController.syllabuses.findOne({ id }, { ...options, projection });
    return document as DbSyllabusDocument | null;
}

async function getMultipleSyllabuses(ids: SyllabusId[], options?: FindOptions): Promise<DbSyllabusDocument[]>
{
    if (!ids || ids.length === 0)
    {
        return [];
    }

    const projection: FindOptions[ 'projection' ] = { ...options?.projection, _id: false };
    const cursor = databaseController.syllabuses.find({ id: { $in: ids } }, { ...options, projection });
    return cursor.toArray() as Promise<DbSyllabusDocument[]>;
}

async function getSyllabusesByFilter(filter: Filter<DbSyllabusDocument>, options?: FindOptions): Promise<DbSyllabusDocument[]>
{
    const projection: FindOptions[ 'projection' ] = { ...options?.projection, _id: false };
    const cursor = databaseController.syllabuses.find(filter, { ...options, projection });
    return cursor.toArray() as Promise<DbSyllabusDocument[]>;
}

async function countSyllabusesByFilter(filter: Filter<DbSyllabusDocument>, options?: FindOptions): Promise<number>
{
    const count = await databaseController.syllabuses.countDocuments(filter, { ...options });
    return count;
}

async function createSyllabus(data: Omit<DbSyllabusDocument, 'createdAt' | 'updatedAt'>, options?: InsertOneOptions): Promise<DbSyllabusDocument>
{
    if (!data.id)
    {
        throw new ClientApiError('Syllabus ID is missing! Client must provide a UUID.');
    }

    const now = new Date();
    const newDocument: DbSyllabusDocument = {
        ...data,
        createdAt: now,
        updatedAt: now,
    };

    await databaseController.syllabuses.insertOne(newDocument, options);

    return newDocument;
}

async function updateSyllabus(id: SyllabusId, updateData: Partial<Omit<DbSyllabusDocument, 'id' | 'createdAt'>>, options?: FindOneAndUpdateOptions): Promise<DbSyllabusDocument>
{
    if (!id)
    {
        throw new ClientApiError('Syllabus ID is required for updates.');
    }

    const updatePayload = {
        ...updateData,
        updatedAt: new Date(),
    };

    // Prevent accidental ID overwrites
    delete (updatePayload as any).id;

    const projection: FindOptions[ 'projection' ] = { ...options?.projection, _id: false };
    // findOneAndUpdate with returnDocument: 'after' ensures we get the exact DB state post-update atomically
    const updatedDocument = await databaseController.syllabuses.findOneAndUpdate(
        { id },
        { $set: updatePayload },
        { returnDocument: 'after', ...options, projection }
    );

    if (!updatedDocument)
    {
        throw new ClientApiError(`Syllabus ${id} not found or update failed.`);
    }

    return updatedDocument as DbSyllabusDocument;
}

async function deleteSyllabus(id: SyllabusId, options?: DeleteOptions): Promise<void>
{
    if (!id)
    {
        throw new ClientApiError('Syllabus ID is required for deletion.');
    }

    const result = await databaseController.syllabuses.deleteOne({ id }, options);

    if (result.deletedCount === 0)
    {
        throw new ClientApiError(`Failed to delete: Syllabus ${id} not found.`);
    }
}

async function listSyllabus(filters?: Filter<DbSyllabusDocument>): Promise<Array<SyllabusId>>
{
    const cursor = databaseController.syllabuses.find(
        filters ?? {},
        {
            projection: { id: 1, _id: 0 },
            sort: { updatedAt: -1 } // -1 for descending (newest first), 1 for ascending
        }
    );

    const documents = await cursor.toArray();

    // Map over the documents to extract just the IDs and satisfy the return type
    return documents.map(doc => doc.id as SyllabusId);
}

async function addModuleToSyllabus(syllabusId: SyllabusId, moduleId: ModuleId): Promise<void>
{
    const updateResult = await databaseController.syllabuses.updateOne({ id: syllabusId }, { '$addToSet': { 'modules': moduleId } });
    if (updateResult.matchedCount !== 1)
    {
        throw new ClientApiError(`No syllabus by id ${syllabusId}`);
    }
    if (updateResult.modifiedCount !== 1)
    {
        throw new ClientApiError(`Failed to add ${moduleId} to ${syllabusId}`);
    }
}

async function removeModuleRemoveSyllabus(syllabusId: SyllabusId, moduleId: ModuleId): Promise<void>
{
    const updateResult = await databaseController.syllabuses.updateOne({ id: syllabusId }, { '$pull': { 'modules': moduleId } });
    if (updateResult.matchedCount !== 1)
    {
        throw new ClientApiError(`No syllabus by id ${syllabusId}`);
    }
    if (updateResult.modifiedCount !== 1)
    {
        throw new ClientApiError(`Failed to remove ${moduleId} from ${syllabusId}`);
    }
}

export const DbSyllabus = {
    get: getSyllabus,
    getMultiple: getMultipleSyllabuses,
    getByFilter: getSyllabusesByFilter,
    countByFilter: countSyllabusesByFilter,
    create: createSyllabus,
    update: updateSyllabus,
    delete: deleteSyllabus,
    list: listSyllabus,
    addModule: addModuleToSyllabus,
    removeModule: removeModuleRemoveSyllabus,
} as const;
