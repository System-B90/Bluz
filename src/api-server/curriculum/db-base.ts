import { ClientApiError } from "@/api-shared/errors";
import { BaseGantItem } from "@/api-shared/types/curriculum";
import { Filter, FindOptions, InsertOneOptions, FindOneAndUpdateOptions, DeleteOptions, Collection, OptionalUnlessRequiredId, UpdateFilter } from "mongodb";
import { v4 as uuidv4 } from 'uuid';

export type BaseDbDocument = {
    createdAt: Date;
    updatedAt: Date;
};

export interface CurriculumDbOperationsBuilderProps<T extends BaseGantItem>
{
    dbCollection: Collection<T & BaseDbDocument>;
    typeName: string;
}

export interface BasicGantOperations<T extends BaseGantItem>
{
    readonly getItem: (id: T[ "id" ], options?: FindOptions) => Promise<T & BaseDbDocument | null>;
    readonly getMultipleItems: (ids: Array<T[ "id" ]>, options?: FindOptions) => Promise<Array<T & BaseDbDocument>>;
    readonly getItemsByFilter: (filter: Filter<T & BaseDbDocument>, options?: FindOptions) => Promise<Array<T & BaseDbDocument>>;
    readonly countItemsByFilter: (filter: Filter<T & BaseDbDocument>, options?: FindOptions) => Promise<number>;
    readonly createNewItem: (data: Omit<T & BaseDbDocument, "createdAt" | "updatedAt" | "id">, options?: InsertOneOptions) => Promise<T & BaseDbDocument>;
    readonly updateItem: (id: T[ "id" ], updateData: Partial<Omit<T & BaseDbDocument, "id" | "createdAt" | "updatedAt">>, options?: FindOneAndUpdateOptions) => Promise<T & BaseDbDocument>;
    readonly deleteItem: (id: T[ "id" ], options?: DeleteOptions) => Promise<void>;
    readonly listItems: (filters?: Filter<T & BaseDbDocument>) => Promise<Record<T[ "id" ], T[ "title" ]>>;
}

export function curriculumDbOperationsBuilder<T extends BaseGantItem>({
    dbCollection,
    typeName,
}: CurriculumDbOperationsBuilderProps<T>): BasicGantOperations<T>
{
    type DbTDocument = T & BaseDbDocument;

    async function getItem(id: T[ 'id' ], options?: FindOptions): Promise<DbTDocument | null>
    {
        if (!id)
        {
            throw new ClientApiError(`לא הועבר מזהה ${typeName}`);
        }

        const projection: FindOptions[ 'projection' ] = { ...options?.projection, _id: 0 };
        return await dbCollection.findOne({ id } as Filter<DbTDocument>, { ...options, projection }) as DbTDocument | null;
    }

    async function getMultipleItems(ids: Array<T[ 'id' ]>, options?: FindOptions): Promise<DbTDocument[]>
    {
        if (!ids || ids.length === 0)
        {
            return [];
        }

        const projection: FindOptions[ 'projection' ] = { ...options?.projection, _id: 0 };
        const cursor = dbCollection.find({ id: { $in: ids } } as Filter<DbTDocument>, { ...options, projection });
        return await cursor.toArray() as DbTDocument[];
    }

    async function getItemsByFilter(filter: Filter<DbTDocument>, options?: FindOptions): Promise<DbTDocument[]>
    {
        const projection: FindOptions[ 'projection' ] = { ...options?.projection, _id: 0 };
        const cursor = dbCollection.find(filter, { ...options, projection });
        return await cursor.toArray() as DbTDocument[];
    }

    async function countItemsByFilter(filter: Filter<DbTDocument>, options?: FindOptions): Promise<number>
    {
        return await dbCollection.countDocuments(filter, { ...options });
    }

    async function createNewItem(data: Omit<DbTDocument, 'createdAt' | 'updatedAt' | 'id'>, options?: InsertOneOptions): Promise<DbTDocument>
    {
        if (('id' in data && data.id) || ('_id' in data && data._id))
        {
            throw new ClientApiError(`הועבר מזהה ${typeName} בעת יצירה!`);
        }

        const now = new Date();
        const newDocument = {
            ...data,
            id: uuidv4() as T[ 'id' ],
            createdAt: now,
            updatedAt: now,
        } as DbTDocument;

        await dbCollection.insertOne(newDocument as OptionalUnlessRequiredId<DbTDocument>, options);
        delete (newDocument as any)._id; // insertOne mutates the document in place
        return newDocument;
    }

    async function updateItem(
        id: T[ 'id' ],
        updateData: Partial<Omit<DbTDocument, 'id' | 'createdAt' | 'updatedAt'>>,
        options?: FindOneAndUpdateOptions
    ): Promise<DbTDocument>
    {
        if (!id)
        {
            throw new ClientApiError(`מזהה נדרש על מנת לעדכן ${typeName}!`);
        }

        const { id: _idDrop, createdAt: _createdDrop, ...safeUpdateData } = updateData as Record<string, unknown>;

        const updatePayload = {
            ...safeUpdateData,
            updatedAt: new Date(),
        } as UpdateFilter<DbTDocument>[ '$set' ];

        const projection: FindOptions[ 'projection' ] = { ...options?.projection, _id: 0 };

        const updatedDocument = await dbCollection.findOneAndUpdate(
            { id } as Filter<DbTDocument>,
            { $set: updatePayload },
            { returnDocument: 'after', ...options, projection }
        );

        if (!updatedDocument)
        {
            throw new ClientApiError(`${typeName} עם מזהה ${id} לא קיים!`);
        }

        return updatedDocument as DbTDocument;
    }

    async function deleteItem(id: T[ 'id' ], options?: DeleteOptions): Promise<void>
    {
        const result = await dbCollection.deleteOne({ id } as Filter<DbTDocument>, options);

        if (result.deletedCount === 0)
        {
            throw new ClientApiError(`${typeName} עם מזהה ${id} לא קיים!`);
        }
    }

    async function listItems(filters?: Filter<DbTDocument>): Promise<Record<T[ 'id' ], T[ 'title' ]>>
    {
        const cursor = dbCollection.find(
            filters ?? {},
            {
                projection: { id: 1, _id: 0, title: 1 },
                sort: { updatedAt: -1 }
            }
        );

        const documents = await cursor.toArray();

        return documents.reduce((acc, doc) =>
        {
            acc[ doc.id as T[ 'id' ] ] = doc.title;
            return acc;
        }, {} as Record<T[ 'id' ], T[ 'title' ]>);
    }

    return {
        getItem,
        getMultipleItems,
        getItemsByFilter,
        countItemsByFilter,
        createNewItem,
        updateItem,
        deleteItem,
        listItems,
    } as const;
}
