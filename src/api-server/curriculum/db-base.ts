import { postgresDb } from "@/api-server/curriculum";
import { curriculumSyllabuses, moduleToEvents, syllabusModules } from "@/api-server/curriculum/schema";
import { ClientApiError } from "@/api-shared/errors";
import { BaseGantItem } from "@/api-shared/types/gant/curriculum";
import { BasicGantOperations } from "@/app/api/gant/base";
import { eq, inArray, desc } from "drizzle-orm";
import { PgTable, AnyPgColumn } from "drizzle-orm/pg-core";

export const FOREIGN_KEY_VIOLATION = '23503';
export const UNIQUE_VIOLATION = '23505';
export type BaseDbDocument = {
    createdAt: Date;
    updatedAt: Date;
};

/**
 * Junction metadata to handle Many-to-Many arrays
 */
export interface JunctionConfig
{
    table: PgTable<any>;           // e.g., curriculumSyllabuses
    localKey: AnyPgColumn;        // e.g., curriculumSyllabuses.curriculumId
    relationKey: AnyPgColumn;     // e.g., curriculumSyllabuses.syllabusId
    apiKey: string;               // e.g., "syllabuses" (the array field in Frontend T)
}

export interface DrizzleOperationsBuilderProps<TTable extends PgTable>
{
    table: TTable;
    typeName: string;
    junction?: JunctionConfig;
    parentJunction?: { type: 'curriculum' | 'syllabus' | 'module'; };
}

export function drizzleOperationsBuilder<
    T extends BaseGantItem,
    TTable extends PgTable<any>,
    TCreatePayload = Omit<T, 'id'>
>({
    table,
    typeName,
    junction,
    parentJunction,
}: DrizzleOperationsBuilderProps<TTable>): BasicGantOperations<T, TCreatePayload>
{

    type DbTDocument = T & BaseDbDocument;
    const cols = table as any;

    async function getItem(id: T[ 'id' ]): Promise<DbTDocument>
    {
        if (!id) throw new ClientApiError(`מזהה ${typeName} חסר`);

        if (junction)
        {
            // We explicitly alias the selection to avoid relying on internal table names
            const rows = await postgresDb
                .select({
                    entity: table,
                    junction: junction.table,
                })
                .from(table)
                .leftJoin(junction.table, eq(cols.id, junction.localKey))
                .where(eq(cols.id, id));

            if (rows.length === 0)
            {
                throw new ClientApiError(`${typeName} עם מזהה ${id} לא נמצא`);
            }

            // Use the explicit aliases 'entity' and 'junction'
            const baseEntity = rows[ 0 ].entity;
            const relatedIds = rows
                .map((row) => (row.junction as any)?.[ junction.relationKey.name ])
                .filter(Boolean);

            return {
                ...baseEntity,
                [ junction.apiKey ]: relatedIds,
            } as DbTDocument;
        }

        // Standard path for tables without many-to-many arrays
        const [ result ] = await postgresDb
            .select()
            .from(table)
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

        // For simplicity in generic builders, multiple items are usually fetched flat.
        // If you need relations here, you'd apply the same reduce logic grouped by ID.
        return await postgresDb.select()
            .from(table)
            .where(inArray(cols.id, ids)) as DbTDocument[];
    }

    async function createNewItem(data: TCreatePayload): Promise<DbTDocument>
    {
        const id = (data as any).id || `gen_${crypto.randomUUID()}`;
        const now = new Date();

        // 1. Extract Parent IDs and Base Data
        // We pull these out so they don't get sent to the base table insert
        const { curriculumId, syllabusId, moduleId, ...entityData } = data as any;

        return await postgresDb.transaction(async (tx) =>
        {
            // 2. Insert the Base Entity
            const [ newItem ] = await tx.insert(table).values({
                ...entityData,
                id,
                createdAt: now,
                updatedAt: now,
            }).returning();

            // 3. Handle Parent Linking (Relational Glue)
            // If we are creating a Syllabus under a Curriculum
            if (curriculumId && parentJunction?.type === 'curriculum')
            {
                await tx.insert(curriculumSyllabuses).values({
                    curriculumId: curriculumId,
                    syllabusId: id,
                });
            }
            // If we are creating a Module under a Syllabus
            else if (syllabusId && parentJunction?.type === 'syllabus')
            {
                await tx.insert(syllabusModules).values({
                    syllabusId: syllabusId,
                    moduleId: id,
                });
            }
            // If we are creating an Event under a Module
            else if (moduleId && parentJunction?.type === 'module')
            {
                await tx.insert(moduleToEvents).values({
                    moduleId: moduleId,
                    eventId: id,
                });
            }

            // 4. Return with "Extended" fields (initialize empty arrays)
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

        const [ updatedItem ] = await postgresDb.update(table)
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
        const result = await postgresDb.delete(table).where(eq(cols.id, id)).returning({ deletedId: cols.id });
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
            .from(table)
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
