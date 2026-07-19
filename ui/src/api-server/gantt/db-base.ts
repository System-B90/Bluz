import { desc, eq, inArray } from "drizzle-orm";
import { AnyPgColumn, PgTableWithColumns } from "drizzle-orm/pg-core";

import { postgresDb } from "@/api-server/gantt";
import { ClientApiError } from "@/api-shared/errors";
import {
    BaseGantItem,
    GanttCurriculumId,
    GanttModuleId,
    GanttSyllabusId,
    GanttWeekId,
} from "@/api-shared/types/gantt/models";
import { BasicGantOperations } from "@/app/api/gantt/base-collection";

export const FOREIGN_KEY_VIOLATION = "23503";
export const UNIQUE_VIOLATION = "23505";
export type BaseDbDocument = {
    createdAt: Date;
    updatedAt: Date;
};

export type JunctionConfig = {
    table: PgTableWithColumns<any>;
    localKey: AnyPgColumn;
    relationKey: AnyPgColumn;
    apiKey: string;
};

export type ParentJunctionConfig = {
    table: PgTableWithColumns<any>;
    parentKey: string;
    selfKey: string;
};

export type DrizzleOperationsBuilderProps<
    TTable extends PgTableWithColumns<any>,
> = {
    table: TTable;
    typeName: string;
    junction?: Array<JunctionConfig> | JunctionConfig;
    parentJunction?: ParentJunctionConfig;
    idPrefix: "c" | "d" | "e" | "m" | "s" | "w";
};

export function drizzleOperationsBuilder<
    T extends BaseGantItem,
    TTable extends PgTableWithColumns<any>,
    TCreatePayload = Omit<T, "id">,
>({
    table,
    typeName,
    junction,
    parentJunction,
    idPrefix,
}: DrizzleOperationsBuilderProps<TTable>): Omit<
    BasicGantOperations<T, TCreatePayload>,
    "getItem"
> {
    type DbTDocument = T & BaseDbDocument;
    type EntityColumns = {
        id: AnyPgColumn;
        title: AnyPgColumn;
        updatedAt: AnyPgColumn;
    };
    const cols = table as unknown as EntityColumns;

    async function getMultipleItems(
        ids: Array<T["id"]>,
    ): Promise<Array<DbTDocument>> {
        if (!ids || ids.length === 0) return [];

        return (await postgresDb
            .select()
            .from(table as PgTableWithColumns<any>)
            .where(inArray(cols.id, ids))) as Array<DbTDocument>;
    }

    async function createNewItem(data: TCreatePayload): Promise<DbTDocument> {
        const id =
            (data as Partial<Pick<T, "id">>).id ||
            `${idPrefix}_${crypto.randomUUID()}`;
        const now = new Date();

        const { curriculumId, syllabusId, moduleId, weekId, ...entityData } =
            data as {
                curriculumId?: GanttCurriculumId;
                syllabusId?: GanttSyllabusId;
                moduleId?: GanttModuleId;
                weekId?: GanttWeekId;
            } & TCreatePayload;

        const parentId: Record<string, string | undefined> = {
            curriculumId,
            syllabusId,
            moduleId,
            weekId,
        };

        return await postgresDb.transaction(async (tx) => {
            const [newItem] = await tx
                .insert(table as PgTableWithColumns<any>)
                .values({
                    ...entityData,
                    id,
                    createdAt: now,
                    updatedAt: now,
                })
                .returning();

            if (parentJunction) {
                const parentIdValue = parentId[parentJunction.parentKey];
                if (!parentIdValue) {
                    throw new ClientApiError("No parent key was passed!");
                }

                const values = {
                    [parentJunction.parentKey]: parentIdValue,
                    [parentJunction.selfKey]: id,
                };
                await tx.insert(parentJunction.table).values(values);
            }

            const junctions = Array.isArray(junction) ? junction : [junction];
            for (const j of junctions) {
                if (j?.apiKey) {
                    (newItem as Record<string, unknown>)[j.apiKey] = [];
                }
            }

            return newItem as DbTDocument;
        });
    }

    async function updateItem(
        id: T["id"],
        updateData: Partial<T>,
    ): Promise<DbTDocument> {
        if (!id) throw new ClientApiError(`מזהה נדרש לעדכון ${typeName}`);

        const {
            id: _id,
            createdAt: _c,
            updatedAt: _u,
            ...safeData
        } = updateData as Partial<T> & Partial<BaseDbDocument>;

        const [updatedItem] = await postgresDb
            .update(table as PgTableWithColumns<any>)
            .set({
                ...safeData,
                updatedAt: new Date(),
            })
            .where(eq(cols.id, id))
            .returning();

        if (!updatedItem) {
            throw new ClientApiError(
                `${typeName} עם מזהה ${id} לא נמצא לעדכון`,
            );
        }

        return updatedItem as DbTDocument;
    }

    async function deleteItem(id: T["id"]): Promise<void> {
        const result = await postgresDb
            .delete(table as PgTableWithColumns<any>)
            .where(eq(cols.id, id))
            .returning({ deletedId: cols.id });
        if (result.length === 0) {
            throw new ClientApiError(
                `${typeName} עם מזהה ${id} לא נמצא למחיקה`,
            );
        }
    }

    async function listItems(): Promise<Record<T["id"], T["title"]>> {
        const results = await postgresDb
            .select({
                id: cols.id,
                title: cols.title,
            })
            .from(table as PgTableWithColumns<any>)
            .orderBy(desc(cols.updatedAt));

        return results.reduce(
            (acc, row) => {
                acc[row.id as T["id"]] = row.title;
                return acc;
            },
            {} as Record<T["id"], T["title"]>,
        );
    }

    return {
        getMultipleItems,
        createNewItem,
        updateItem,
        deleteItem,
        listItems,
    } as const;
}
