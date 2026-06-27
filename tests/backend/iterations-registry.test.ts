import { beforeEach, describe, it, expect, vi } from "vitest";

// In-memory fake of the meta `iterations` collection, supporting just the query
// shapes DbIterations actually uses ({} / {id} / {isCurrent:true}). Defined via
// vi.hoisted so it is available inside the hoisted vi.mock factory below.
const { docs, iterations, setCurrentIterationDbName } = vi.hoisted(() => {
    type Doc = Record<string, any>;
    const docs: Array<Doc> = [];
    const matches = (doc: Doc, filter: Doc): boolean =>
        Object.entries(filter).every(([k, v]) => doc[k] === v);

    const iterations = {
        findOne: vi.fn(async (filter: Doc = {}) => {
            return docs.find((d) => matches(d, filter)) ?? null;
        }),
        find: vi.fn((filter: Doc = {}) => ({
            sort: () => ({
                toArray: async () => docs.filter((d) => matches(d, filter)),
            }),
        })),
        insertOne: vi.fn(async (doc: Doc) => {
            docs.push({ ...doc });
            return { insertedId: "x" };
        }),
        updateOne: vi.fn(async (filter: Doc, update: Doc) => {
            const doc = docs.find((d) => matches(d, filter));
            if (doc) Object.assign(doc, update.$set);
            return { matchedCount: doc ? 1 : 0 };
        }),
        updateMany: vi.fn(async (filter: Doc, update: Doc) => {
            const targets = docs.filter((d) => matches(d, filter));
            targets.forEach((d) => Object.assign(d, update.$set));
            return { matchedCount: targets.length };
        }),
    };

    return { docs, iterations, setCurrentIterationDbName: vi.fn() };
});

vi.mock("@/api-server/mongo-db-controller", () => ({
    DEFAULT_ITERATION_DB_NAME: "bluz",
    getMetaController: () => ({ iterations }),
    getDatabaseController: vi.fn((name: string) => ({ dbName: name })),
    setCurrentIterationDbName,
}));

import { DbIterations } from "@/api-server/db-iterations";
import { ClientApiError } from "@/api-shared/errors";

beforeEach(() => {
    docs.length = 0;
    vi.clearAllMocks();
});

describe("DbIterations.ensure (migration seed)", () => {
    it("seeds the existing bluz DB as the current iteration when empty", async () => {
        await DbIterations.ensure();
        expect(docs).toHaveLength(1);
        expect(docs[0]).toMatchObject({
            dbName: "bluz",
            isCurrent: true,
        });
        expect(setCurrentIterationDbName).toHaveBeenCalledWith("bluz");
    });

    it("is idempotent — does not duplicate the seed", async () => {
        await DbIterations.ensure();
        await DbIterations.ensure();
        expect(docs).toHaveLength(1);
    });
});

describe("DbIterations.register", () => {
    it("derives a safe dbName from the id and starts non-current", async () => {
        await DbIterations.ensure();
        const created = await DbIterations.register({
            id: "2026b",
            label: "מחזור 2026 ב'",
        });
        expect(created.dbName).toBe("bluz_2026b");
        expect(created.isCurrent).toBe(false);
        expect(docs).toHaveLength(2);
    });

    it("rejects a duplicate id", async () => {
        await DbIterations.ensure();
        await DbIterations.register({ id: "dup", label: "Dup" });
        await expect(
            DbIterations.register({ id: "dup", label: "Dup again" }),
        ).rejects.toBeInstanceOf(ClientApiError);
    });

    it("requires id and label", async () => {
        await expect(
            DbIterations.register({ id: "", label: "" } as any),
        ).rejects.toBeInstanceOf(ClientApiError);
    });
});

describe("DbIterations.patch (set current)", () => {
    it("demotes the previously current iteration and promotes the new one", async () => {
        await DbIterations.ensure(); // seeds "current" (bluz) as current
        await DbIterations.register({ id: "2026b", label: "B" });

        const updated = await DbIterations.patch("2026b", { isCurrent: true });

        expect(updated.isCurrent).toBe(true);
        const seed = docs.find((d) => d.dbName === "bluz");
        expect(seed?.isCurrent).toBe(false);
        expect(setCurrentIterationDbName).toHaveBeenLastCalledWith("bluz_2026b");
    });

    it("throws for an unknown iteration", async () => {
        await expect(
            DbIterations.patch("nope", { label: "x" }),
        ).rejects.toBeInstanceOf(ClientApiError);
    });
});

describe("DbIterations.assertWritable (read-only guard)", () => {
    it("allows writes to the current iteration", async () => {
        await DbIterations.ensure();
        await DbIterations.register({ id: "2026b", label: "B" });
        await DbIterations.patch("2026b", { isCurrent: true });
        await expect(
            DbIterations.assertWritable("2026b"),
        ).resolves.toBeUndefined();
    });

    it("allows writes when no iteration is specified (current run)", async () => {
        await expect(DbIterations.assertWritable()).resolves.toBeUndefined();
    });

    it("rejects writes to a past (non-current) iteration", async () => {
        await DbIterations.ensure();
        await DbIterations.register({ id: "2026b", label: "B" });
        await expect(
            DbIterations.assertWritable("2026b"),
        ).rejects.toBeInstanceOf(ClientApiError);
    });

    it("rejects writes to an unknown iteration", async () => {
        await DbIterations.ensure();
        await expect(
            DbIterations.assertWritable("ghost"),
        ).rejects.toBeInstanceOf(ClientApiError);
    });
});

describe("DbIterations.list / current / get", () => {
    it("lists iterations and resolves the current one", async () => {
        await DbIterations.ensure();
        await DbIterations.register({ id: "2026b", label: "B" });

        const all = await DbIterations.list();
        expect(all).toHaveLength(2);

        const current = await DbIterations.current();
        expect(current.dbName).toBe("bluz");

        const fetched = await DbIterations.get("2026b");
        expect(fetched?.id).toBe("2026b");

        const missing = await DbIterations.get("nope");
        expect(missing).toBeNull();
    });

    it("strips the Mongo _id from returned documents", async () => {
        docs.push({
            _id: "mongoid",
            id: "withId",
            label: "L",
            dbName: "bluz_withId",
            isCurrent: false,
            startDate: new Date(),
            endDate: null,
            createdAt: new Date(),
            updatedAt: new Date(),
        });
        const fetched = await DbIterations.get("withId");
        expect(fetched).not.toHaveProperty("_id");
    });
});
