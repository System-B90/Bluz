import { eq, inArray, desc } from "drizzle-orm";
import { AnyPgColumn, PgTableWithColumns } from "drizzle-orm/pg-core";

import { postgresDb } from "@/api-server/curriculum";
import { curriculumSyllabuses, moduleToEvents, syllabusModules } from "@/api-server/curriculum/schema";
import { ClientApiError } from "@/api-shared/errors";
import { BaseGantItem } from "@/api-shared/types/gant/curriculum";
import { BasicGantOperations } from "@/app/api/gant/base-collection";

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

export interface DrizzleOperationsBuilderProps<TTable extends PgTableWithColumns<any>>
{
    table: TTable;
    typeName: string;
    junction?: JunctionConfig;
    parentJunction?: { type: 'curriculum' | 'module' | 'syllabus'; };
    idPreffix: 'c' | 'e' | 'm' | 's';
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
}: DrizzleOperationsBuilderProps<TTable>): BasicGantOperations<T, TCreatePayload>
{

    type DbTDocument = T & BaseDbDocument;
    const cols = table as any;

    async function getItem(id: T[ 'id' ]): Promise<DbTDocument>
    {
        if (!id) throw new ClientApiError(`מזהה ${typeName} חסר`);

        if (junction)
        {
            const rows = await postgresDb
                .select({
                    entity: table,
                    junction: junction.table,
                })
                .from(table as any)
                .leftJoin(junction.table as any, eq(cols.id, junction.localKey))
                .where(eq(cols.id, id));

            if (rows.length === 0)
            {
                throw new ClientApiError(`${typeName} עם מזהה ${id} לא נמצא`);
            }

            const baseEntity = rows[ 0 ].entity as Record<string, any>;
            const relatedIds = rows
                .map((row) => (row.junction as any)?.[ junction.relationKey.name ])
                .filter(Boolean);

            return {
                ...baseEntity,
                [ junction.apiKey ]: relatedIds,
            } as DbTDocument;
        }

        const [ result ] = await postgresDb
            .select()
            .from(table as any)
            .where(eq(cols.id, id))
            .limit(1);

        if (!result)
        {
            throw new ClientApiError(`${typeName} עם מזהה ${id} לא נמצא`);
        }

        return result as DbTDocument;
    }

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

        const { curriculumId, syllabusId, moduleId, ...entityData } = data as any;

        return await postgresDb.transaction(async (tx) =>
        {
            const [ newItem ] = await tx.insert(table as any).values({
                ...entityData,
                id,
                createdAt: now,
                updatedAt: now,
            }).returning();

            if (curriculumId && parentJunction?.type === 'curriculum')
            {
                await tx.insert(curriculumSyllabuses).values({
                    curriculumId: curriculumId,
                    syllabusId: id,
                });
            } else if (syllabusId && parentJunction?.type === 'syllabus')
            {
                await tx.insert(syllabusModules).values({
                    syllabusId: syllabusId,
                    moduleId: id,
                });
            } else if (moduleId && parentJunction?.type === 'module')
            {
                await tx.insert(moduleToEvents).values({
                    moduleId: moduleId,
                    eventId: id,
                });
            }

            if (junction?.apiKey)
            {
                (newItem as any)[ junction.apiKey ] = [];
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
        getItem,
        getMultipleItems,
        createNewItem,
        updateItem,
        deleteItem,
        listItems,
    } as const;
}
