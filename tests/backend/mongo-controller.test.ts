import { beforeEach, describe, it, expect } from "vitest";

import {
    DEFAULT_ITERATION_DB_NAME,
    getCurrentIterationDbName,
    getDatabaseController,
    resolveIterationDb,
    setCurrentIterationDbName,
} from "@/api-server/mongo-db-controller";

beforeEach(() => {
    // Reset the in-process current iteration to the default for each test.
    setCurrentIterationDbName(DEFAULT_ITERATION_DB_NAME);
});

describe("getDatabaseController caching", () => {
    it("returns the same instance for the same db name", () => {
        const a = getDatabaseController("bluz_2026b");
        const b = getDatabaseController("bluz_2026b");
        expect(a).toBe(b);
        expect(a.dbName).toBe("bluz_2026b");
    });

    it("returns distinct instances for different db names", () => {
        const a = getDatabaseController("bluz_a");
        const b = getDatabaseController("bluz_b");
        expect(a).not.toBe(b);
    });

    it("defaults to the default iteration db name", () => {
        expect(getDatabaseController().dbName).toBe(DEFAULT_ITERATION_DB_NAME);
    });
});

describe("current iteration db name", () => {
    it("defaults to the migrated database", () => {
        expect(getCurrentIterationDbName()).toBe(DEFAULT_ITERATION_DB_NAME);
    });

    it("can be repointed in-process", () => {
        setCurrentIterationDbName("bluz_2026b");
        expect(getCurrentIterationDbName()).toBe("bluz_2026b");
    });
});

describe("resolveIterationDb (default path, no Mongo)", () => {
    it("resolves the current controller when no id is given", async () => {
        const controller = await resolveIterationDb();
        expect(controller.dbName).toBe(DEFAULT_ITERATION_DB_NAME);
    });

    it("follows the current iteration after a repoint", async () => {
        setCurrentIterationDbName("bluz_2026b");
        const controller = await resolveIterationDb();
        expect(controller.dbName).toBe("bluz_2026b");
    });
});
