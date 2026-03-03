import databaseController from "@/api-server/mongo-db-controller";
import { ClientApiError } from "@/api-shared/errors";
import { Curriculum, CurriculumId, SyllabusId } from "@/api-shared/types/curriculum";
import { Filter, FindOptions, InsertOneOptions, FindOneAndUpdateOptions, DeleteOptions } from "mongodb";

export type BaseDbDocument = {
    createdAt: Date;
    updatedAt: Date;
};
type DbCurriculumDocument = Curriculum & BaseDbDocument;

async function getCurriculum(id: CurriculumId, options?: FindOptions): Promise<DbCurriculumDocument | null>
{
    if (!id)
    {
        throw new ClientApiError('Curriculum ID is required.');
    }

    const document = await databaseController.curriculums.findOne({ id }, options);
    return document as DbCurriculumDocument | null;
}

async function getMultipleCurriculums(ids: CurriculumId[], options?: FindOptions): Promise<DbCurriculumDocument[]>
{
    if (!ids || ids.length === 0)
    {
        return [];
    }

    const cursor = databaseController.curriculums.find({ id: { $in: ids } }, options);
    return cursor.toArray() as Promise<DbCurriculumDocument[]>;
}

async function getCurriculumsByFilter(filter: Filter<DbCurriculumDocument>, options?: FindOptions): Promise<DbCurriculumDocument[]>
{
    const cursor = databaseController.curriculums.find(filter, options);
    return cursor.toArray() as Promise<DbCurriculumDocument[]>;
}

async function createCurriculum(data: Omit<DbCurriculumDocument, 'createdAt' | 'updatedAt'>, options?: InsertOneOptions): Promise<DbCurriculumDocument>
{
    if (!data.id)
    {
        throw new ClientApiError('Curriculum ID is missing! Client must provide a UUID.');
    }

    const now = new Date();
    const newDocument: DbCurriculumDocument = {
        ...data,
        createdAt: now,
        updatedAt: now,
    };

    await databaseController.curriculums.insertOne(newDocument, options);

    return newDocument;
}

async function updateCurriculum(id: CurriculumId, updateData: Partial<Omit<DbCurriculumDocument, 'id' | 'createdAt'>>, options?: FindOneAndUpdateOptions): Promise<DbCurriculumDocument>
{
    if (!id)
    {
        throw new ClientApiError('Curriculum ID is required for updates.');
    }

    const updatePayload = {
        ...updateData,
        updatedAt: new Date(),
    };

    // Prevent accidental ID overwrites
    delete (updatePayload as any).id;

    // findOneAndUpdate with returnDocument: 'after' ensures we get the exact DB state post-update atomically
    const updatedDocument = await databaseController.curriculums.findOneAndUpdate(
        { id },
        { $set: updatePayload },
        { returnDocument: 'after', ...options }
    );

    if (!updatedDocument)
    {
        throw new ClientApiError(`Curriculum ${id} not found or update failed.`);
    }

    return updatedDocument as DbCurriculumDocument;
}

async function deleteCurriculum(id: CurriculumId, options?: DeleteOptions): Promise<void>
{
    if (!id)
    {
        throw new ClientApiError('Curriculum ID is required for deletion.');
    }

    const result = await databaseController.curriculums.deleteOne({ id }, options);

    if (result.deletedCount === 0)
    {
        throw new ClientApiError(`Failed to delete: Curriculum ${id} not found.`);
    }
}

async function listCurriculum(filters?: Filter<DbCurriculumDocument>): Promise<Array<CurriculumId>>
{
    const cursor = databaseController.curriculums.find(
        filters ?? {},
        {
            projection: { id: 1, _id: 0 },
            sort: { updatedAt: -1 } // -1 for descending (newest first), 1 for ascending
        }
    );

    const documents = await cursor.toArray();

    // Map over the documents to extract just the IDs and satisfy the return type
    return documents.map(doc => doc.id as CurriculumId);
}

async function addSyllabusToCurriculum(curriculumId: CurriculumId, syllabusId: SyllabusId): Promise<void>
{
    const updateResult = await databaseController.curriculums.updateOne({ id: curriculumId }, { '$addToSet': { 'syllabuses': syllabusId } });
    if (updateResult.matchedCount !== 1)
    {
        throw new ClientApiError(`No curriculum by id ${curriculumId}`);
    }
    if (updateResult.modifiedCount !== 1)
    {
        throw new ClientApiError(`Failed to add ${syllabusId} to ${curriculumId}`);
    }
}

export const DbCurriculum = {
    get: getCurriculum,
    getMultiple: getMultipleCurriculums,
    getByFilter: getCurriculumsByFilter,
    create: createCurriculum,
    update: updateCurriculum,
    delete: deleteCurriculum,
    list: listCurriculum,
    addSyllabus: addSyllabusToCurriculum,
} as const;
