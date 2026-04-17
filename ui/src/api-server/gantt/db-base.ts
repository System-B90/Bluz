import { desc, eq, inArray } from "drizzle-orm";
import { AnyPgColumn, PgTableWithColumns } from "drizzle-orm/pg-core";

import { postgresDb } from "@/api-server/gantt";
import { ClientApiError } from "@/api-shared/errors";
import { BaseGantItem, CurriculumId, ModuleId, SyllabusId } from "@/api-shared/types/gantt/curriculum";
import { BasicGantOperations } from "@/app/api/gantt/base-collection";

export const FOREIGN_KEY_VIOLATION = '23503';
export const UNIQUE_VIOLATION = '23505';
export type BaseDbDocument = {
    createdAt: Date;
    updatedAt: Date;
};

export interface JunctionConfig
{
    table: PgTableWithColumns<any>;
    localKey: AnyPgColumn;
    relationKey: AnyPgColumn;
    apiKey: string;
}

export interface ParentJunctionConfig
{
    table: PgTableWithColumns<any>;
    parentKey: string;
    selfKey: string;
}

export interface DrizzleOperationsBuilderProps<TTable extends PgTableWithColumns<any>>
{
    table: TTable;
    typeName: string;
    junction?: Array<JunctionConfig> | JunctionConfig;
    parentJunction?: ParentJunctionConfig;
    idPreffix: 'c' | 'd' | 'e' | 'm' | 's' | 'w';
}

export function drizzleOperationsBuilder<
    T extends BaseGantItem,
    TTable extends PgTableWithColumns<any>,
    TCreatePayload = Omit<T, 'id'>
>({
    table,
    typeName,
    junction,
    parentJunction,
    idPreffix,
}: DrizzleOperationsBuilderProps<TTable>): Omit<BasicGantOperations<T, TCreatePayload>, 'getItem'>
{
    type DbTDocument = T & BaseDbDocument;
    const cols = table as any;

    async function getMultipleItems(ids: Array<T[ 'id' ]>): Promise<DbTDocument[]>
    {
        if (!ids || ids.length === 0) return [];

        return await postgresDb.select()
            .from(table as any)
            .where(inArray(cols.id, ids)) as DbTDocument[];
    }

    async function createNewItem(data: TCreatePayload): Promise<DbTDocument>
    {
        const id = (data as any).id || `${idPreffix}_${crypto.randomUUID()}`;
        const now = new Date();

        const { curriculumId, syllabusId, moduleId, ...entityData } = data as {
            curriculumId?: CurriculumId;
            syllabusId?: SyllabusId;
            moduleId?: ModuleId;
        } & TCreatePayload;

        const parentId: Record<string, string | undefined> = { curriculumId, syllabusId, moduleId };

        return await postgresDb.transaction(async (tx) =>
        {
            const [ newItem ] = await tx.insert(table as any).values({
                ...entityData,
                id,
                createdAt: now,
                updatedAt: now,
            }).returning();

            if (parentJunction)
            {
                const parentIdValue = parentId[ parentJunction.parentKey ];
                if (!parentIdValue)
                {
                    throw new ClientApiError('No parent key was passed!');
                }

                const values = {
                    [ parentJunction.parentKey ]: parentIdValue,
                    [ parentJunction.selfKey ]: id,

                };
                await tx.insert(parentJunction.table).values(values);
            }

            const junctions = Array.isArray(junction) ? junction : [ junction ];
            for (const j of junctions)
            {
                if (j?.apiKey)
                {
                    (newItem as any)[ j.apiKey ] = [];
                }
            }

            return newItem as DbTDocument;
        });
    }

    async function updateItem(id: T[ 'id' ], updateData: Partial<T>): Promise<DbTDocument>
    {
        if (!id) throw new ClientApiError(`מזהה נדרש לעדכון ${typeName}`);

        const { id: _id, createdAt: _c, updatedAt: _u, ...safeData } = updateData as any;

        const [ updatedItem ] = await postgresDb.update(table as any)
            .set({
                ...safeData,
                updatedAt: new Date(),
            })
            .where(eq(cols.id, id))
            .returning();

        if (!updatedItem)
        {
            throw new ClientApiError(`${typeName} עם מזהה ${id} לא נמצא לעדכון`);
        }

        return updatedItem as DbTDocument;
    }

    async function deleteItem(id: T[ 'id' ]): Promise<void>
    {
        const result = await postgresDb.delete(table as any).where(eq(cols.id, id)).returning({ deletedId: cols.id });
        if (result.length === 0)
        {
            throw new ClientApiError(`${typeName} עם מזהה ${id} לא נמצא למחיקה`);
        }
    }

    async function listItems(): Promise<Record<T[ 'id' ], T[ 'title' ]>>
    {
        const results = await postgresDb.select({
            id: cols.id,
            title: cols.title
        })
            .from(table as any)
            .orderBy(desc(cols.updatedAt));

        return results.reduce((acc, row) =>
        {
            acc[ row.id as T[ 'id' ] ] = row.title;
            return acc;
        }, {} as Record<T[ 'id' ], T[ 'title' ]>);
    }

    return {
        getMultipleItems,
        createNewItem,
        updateItem,
        deleteItem,
        listItems,
    } as const;
}
