import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Parent-id surfacing on the shared Drizzle operations builder (#310).
 *
 * The junction tables all have a composite `(parent, child)` primary key, so
 * the schema alone permits many parents everywhere. The real rules are
 * per-junction, and `cardinality` is what encodes them:
 *
 *   event -> module        one
 *   module -> syllabus     one
 *   day -> week            one
 *   week -> curriculum     one
 *   syllabus -> curriculum many
 *
 * These tests pin that mapping and the determinism of the result, both of
 * which are invisible until a child actually has two parents.
 */

/** Rows the fake junction select will return, set per test. */
let junctionRows: Array<{ selfId: string; parentId: string }> = [];
/** Rows the fake entity select will return, set per test. */
let entityRows: Array<Record<string, unknown>> = [];

vi.mock("@/api-server/gantt", () => ({
    postgresDb: {
        select: (projection?: Record<string, unknown>) => ({
            from: () => {
                // `attachParentIds` projects `{ selfId, parentId }` while
                // `listItems` projects `{ id, title }`. The projection keys are
                // how this fake tells the two queries apart.
                const isJunctionQuery =
                    projection !== undefined && "selfId" in projection;
                const rows = isJunctionQuery ? junctionRows : entityRows;
                const result = {
                    where: async () => rows,
                    orderBy: async () => rows,
                    then: (resolve: (value: unknown) => unknown) =>
                        resolve(rows),
                };
                return result;
            },
        }),
    },
}));

import { drizzleOperationsBuilder } from "@/api-server/gantt/db-base";
import { BaseGantItem } from "@/api-shared/types/gantt/models";

const fakeTable = {
    id: "id_col",
    title: "title_col",
    updatedAt: "updated_col",
} as never;

const fakeJunction = {
    parentCol: "parent_col",
    childCol: "child_col",
} as never;

function buildOps(cardinality: "many" | "one", outputKey?: string) {
    return drizzleOperationsBuilder<BaseGantItem, typeof fakeTable>({
        table: fakeTable,
        typeName: "test",
        idPrefix: "m",
        parentJunction: {
            table: fakeJunction,
            parentKey: "parentCol",
            outputKey,
            selfKey: "childCol",
            cardinality,
        },
    });
}

beforeEach(() => {
    junctionRows = [];
    entityRows = [];
});

describe("attachParentIds - cardinality (#310)", () => {
    it("surfaces a scalar for a one-parent junction", async () => {
        junctionRows = [{ selfId: "m_1", parentId: "s_1" }];
        const ops = buildOps("one");

        const [item] = await ops.attachParentIds([{ id: "m_1" }]);

        expect(item).toEqual({ id: "m_1", parentCol: "s_1" });
    });

    it("surfaces null for a one-parent child with no junction row", async () => {
        junctionRows = [];
        const ops = buildOps("one");

        const [item] = await ops.attachParentIds([{ id: "m_1" }]);

        // REGRESSION: must be an explicit null, not `undefined` or a missing
        // key — consumers distinguish "unlinked" from "not requested".
        expect(item).toEqual({ id: "m_1", parentCol: null });
    });

    it("surfaces an array for a many-parent junction", async () => {
        junctionRows = [
            { selfId: "s_1", parentId: "c_2" },
            { selfId: "s_1", parentId: "c_1" },
        ];
        const ops = buildOps("many", "parentCols");

        const [item] = await ops.attachParentIds([{ id: "s_1" }]);

        // REGRESSION: this is the case the original scalar implementation got
        // wrong — a Map collapsed both rows to whichever arrived last.
        expect(item).toEqual({ id: "s_1", parentCols: ["c_1", "c_2"] });
    });

    it("returns an empty array, not null, for an unlinked many-parent child", async () => {
        junctionRows = [];
        const ops = buildOps("many", "parentCols");

        const [item] = await ops.attachParentIds([{ id: "s_1" }]);

        expect(item).toEqual({ id: "s_1", parentCols: [] });
    });

    it("orders many-parent ids deterministically regardless of row order", async () => {
        const ops = buildOps("many", "parentCols");

        junctionRows = [
            { selfId: "s_1", parentId: "c_3" },
            { selfId: "s_1", parentId: "c_1" },
            { selfId: "s_1", parentId: "c_2" },
        ];
        const [first] = await ops.attachParentIds([{ id: "s_1" }]);

        junctionRows = [
            { selfId: "s_1", parentId: "c_2" },
            { selfId: "s_1", parentId: "c_3" },
            { selfId: "s_1", parentId: "c_1" },
        ];
        const [second] = await ops.attachParentIds([{ id: "s_1" }]);

        // REGRESSION: the junction query has no ORDER BY, so without an
        // explicit sort the same data could come back in a different order
        // between requests and churn React keys.
        expect(first).toEqual(second);
        expect((first as { parentCols: Array<string> }).parentCols).toEqual([
            "c_1",
            "c_2",
            "c_3",
        ]);
    });

    it("keeps parents separated per child in a batch", async () => {
        junctionRows = [
            { selfId: "m_1", parentId: "s_1" },
            { selfId: "m_2", parentId: "s_2" },
        ];
        const ops = buildOps("one");

        const items = await ops.attachParentIds([{ id: "m_1" }, { id: "m_2" }]);

        expect(items).toEqual([
            { id: "m_1", parentCol: "s_1" },
            { id: "m_2", parentCol: "s_2" },
        ]);
    });

    it("uses outputKey for the surfaced field, leaving parentKey for the payload", async () => {
        junctionRows = [{ selfId: "s_1", parentId: "c_1" }];
        const ops = buildOps("many", "curriculumIds");

        const [item] = await ops.attachParentIds([{ id: "s_1" }]);

        // REGRESSION: `parentKey` doubles as the key `createNewItem` reads the
        // parent out of the create payload. Renaming it to surface a plural
        // field would silently stop new items from being linked, so the read
        // name has to live in `outputKey`.
        expect(item).toHaveProperty("curriculumIds", ["c_1"]);
        expect(item).not.toHaveProperty("parentCol");
    });

    it("is a no-op on an empty batch", async () => {
        const ops = buildOps("one");
        await expect(ops.attachParentIds([])).resolves.toEqual([]);
    });
});

describe("listItems - withParents (#310)", () => {
    it("returns the flat label map by default", async () => {
        entityRows = [
            { id: "m_1", title: "A" },
            { id: "m_2", title: "B" },
        ];
        const ops = buildOps("one");

        await expect(ops.listItems()).resolves.toEqual({
            m_1: "A",
            m_2: "B",
        });
    });

    it("returns object values carrying the parent when asked", async () => {
        entityRows = [{ id: "m_1", title: "A" }];
        junctionRows = [{ selfId: "m_1", parentId: "s_1" }];
        const ops = buildOps("one");

        await expect(ops.listItems(true)).resolves.toEqual({
            m_1: { title: "A", parentCol: "s_1" },
        });
    });

    it("omits the id from the value, keeping it only as the map key", async () => {
        entityRows = [{ id: "m_1", title: "A" }];
        junctionRows = [{ selfId: "m_1", parentId: "s_1" }];
        const ops = buildOps("one");

        const result = (await ops.listItems(true)) as Record<
            string,
            Record<string, unknown>
        >;

        // REGRESSION: `attachParentIds` keys off `id`, so the row must carry
        // one while being enriched — but repeating it in the value would
        // bloat every response.
        expect(result.m_1).not.toHaveProperty("id");
    });

    it("carries the array shape through for a many-parent entity", async () => {
        entityRows = [{ id: "s_1", title: "Syllabus" }];
        junctionRows = [
            { selfId: "s_1", parentId: "c_2" },
            { selfId: "s_1", parentId: "c_1" },
        ];
        const ops = buildOps("many", "curriculumIds");

        await expect(ops.listItems(true)).resolves.toEqual({
            s_1: { title: "Syllabus", curriculumIds: ["c_1", "c_2"] },
        });
    });
});
