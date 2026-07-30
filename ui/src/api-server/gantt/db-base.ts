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
    /**
     * Column on the junction table holding the parent id. Doubles as the key
     * `createNewItem` reads the parent out of the create payload, so it must
     * keep matching the payload field — use `outputKey` to surface it under a
     * different name.
     */
    parentKey: string;
    selfKey: string;
    /**
     * Field name the parent is surfaced under on read. Defaults to
     * `parentKey`; set it when the read shape differs, e.g. a `"many"`
     * junction that wants a plural name for its array.
     */
    outputKey?: string;
    /**
     * How many parents a child may have. Every junction table has a composite
     * `(parent, child)` primary key, so the schema permits many everywhere;
     * this records the *domain* rule the schema doesn't express.
     *
     * `"one"` — event→module, module→syllabus, day→week, week→curriculum.
     *   Surfaced as a scalar id, or `null` when unlinked.
     * `"many"` — syllabus→curriculum. A syllabus is deliberately shareable
     *   across curricula (see `addSyllabusToCurriculum`), so collapsing it to
     *   a scalar would pick an arbitrary parent. Surfaced as a sorted array.
     */
    cardinality: "many" | "one";
};

/**
 * A `listItems({ withParents: true })` value: the label plus whichever parent
 * key the entity's `parentJunction` is configured with (`syllabusId` for
 * modules, `moduleId` for events, and so on), or `null` when the child has no
 * junction row.
 */
export type ListItemWithParent<T extends BaseGantItem> = {
    title: T["title"];
} & Record<string, null | string>;

export type ListItemsResult<T extends BaseGantItem> =
    | Record<T["id"], ListItemWithParent<T>>
    | Record<T["id"], T["title"]>;

export type DrizzleOperationsBuilderProps<
    TTable extends PgTableWithColumns<any>,
> = {
    table: TTable;
    typeName: string;
    junction?: Array<JunctionConfig> | JunctionConfig;
    parentJunction?: ParentJunctionConfig;
    idPrefix: "c" | "d" | "e" | "m" | "s" | "w";
    // Entities without a `title` column (weeks, days) must provide the column
    // used as the display label in listItems().
    labelColumn?: AnyPgColumn;
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
    labelColumn,
}: DrizzleOperationsBuilderProps<TTable>): Omit<
    BasicGantOperations<T, TCreatePayload>,
    "getItem"
> & {
    attachParentIds: <TItem extends { id: T["id"] }>(
        items: Array<TItem>,
    ) => Promise<Array<TItem>>;
} {
    type DbTDocument = T & BaseDbDocument;
    type EntityColumns = {
        id: AnyPgColumn;
        title: AnyPgColumn;
        updatedAt: AnyPgColumn;
    };
    const cols = table as unknown as EntityColumns;

    async function attachParentIds<TItem extends { id: T["id"] }>(
        items: Array<TItem>,
    ): Promise<Array<TItem>> {
        if (!parentJunction || items.length === 0) return items;

        const junctionCols = parentJunction.table as unknown as Record<
            string,
            AnyPgColumn
        >;
        const selfCol = junctionCols[parentJunction.selfKey];
        const parentCol = junctionCols[parentJunction.parentKey];

        const links = await postgresDb
            .select({ selfId: selfCol, parentId: parentCol })
            .from(parentJunction.table)
            .where(
                inArray(
                    selfCol,
                    items.map((item) => item.id),
                ),
            );

        const parentsByChild = new Map<unknown, Array<unknown>>();
        for (const link of links) {
            const existing = parentsByChild.get(link.selfId);
            if (existing) existing.push(link.parentId);
            else parentsByChild.set(link.selfId, [link.parentId]);
        }

        for (const item of items) {
            const parents = parentsByChild.get(item.id) ?? [];
            // Sort so a shared child reports the same order every request; the
            // junction query has no inherent ordering.
            parents.sort();
            const outputKey =
                parentJunction.outputKey ?? parentJunction.parentKey;
            (item as Record<string, unknown>)[outputKey] =
                parentJunction.cardinality === "many"
                    ? parents
                    : (parents[0] ?? null);
        }
        return items;
    }

    async function getMultipleItems(
        ids: Array<T["id"]>,
    ): Promise<Array<DbTDocument>> {
        if (!ids || ids.length === 0) return [];

        const items = (await postgresDb
            .select()
            .from(table as PgTableWithColumns<any>)
            .where(inArray(cols.id, ids))) as Array<DbTDocument>;
        return await attachParentIds(items);
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

    /**
     * Lists every item as a label map.
     *
     * With `withParents`, each value becomes `{ title, [parentKey] }` instead
     * of a bare title, so callers can walk child → parent without a second
     * round trip. The flat shape is the default because it is the published
     * contract of `GET /api/gantt/<entity>` and of `apiList` — see #310.
     *
     * Entities configured without a `parentJunction` (curriculums are the
     * root) still return the object form under `withParents`, with no parent
     * key, so the response shape stays predictable per request rather than
     * per entity.
     */
    async function listItems(
        withParents?: boolean,
    ): Promise<ListItemsResult<T>> {
        const label = labelColumn ?? cols.title;
        if (!label) {
            throw new Error(
                `${typeName}: table has no title column and no labelColumn was configured`,
            );
        }
        const results = await postgresDb
            .select({
                id: cols.id,
                title: label,
            })
            .from(table as PgTableWithColumns<any>)
            .orderBy(desc(cols.updatedAt));

        if (!withParents) {
            return results.reduce(
                (acc, row) => {
                    acc[row.id as T["id"]] = row.title as T["title"];
                    return acc;
                },
                {} as Record<T["id"], T["title"]>,
            );
        }

        // `attachParentIds` mutates in place and keys off `id`, so feed it the
        // same rows we are about to return rather than querying twice.
        const rows = results.map((row) => ({
            id: row.id as T["id"],
            title: row.title as T["title"],
        }));
        await attachParentIds(rows);

        return rows.reduce(
            (acc, row) => {
                const { id, ...rest } = row;
                acc[id] = rest as ListItemWithParent<T>;
                return acc;
            },
            {} as Record<T["id"], ListItemWithParent<T>>,
        );
    }

    return {
        getMultipleItems,
        createNewItem,
        updateItem,
        deleteItem,
        listItems,
        attachParentIds,
    } as const;
}
