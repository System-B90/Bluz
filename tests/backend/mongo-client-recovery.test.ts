import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A MongoClient whose first connection attempt fails closes its topology, and
 * the driver never reopens it — every later operation throws
 * "MongoTopologyClosedError: Topology is closed". The app boots beside its
 * database, so that first attempt regularly lands while Mongo is still
 * starting, and the process then stayed permanently unable to reach Mongo
 * while still serving pages.
 */
const constructed: Array<{ destroyed: boolean }> = [];

vi.mock("mongodb", () => ({
    MongoClient: class {
        public topology: { isDestroyed: () => boolean };

        constructor() {
            const state = { destroyed: false };
            constructed.push(state);
            this.topology = { isDestroyed: () => state.destroyed };
        }

        db(name: string) {
            const client = this;
            return {
                databaseName: name,
                collection: (collectionName: string) => ({
                    collectionName,
                    client,
                }),
            };
        }
    },
}));

beforeEach(() => {
    constructed.length = 0;
    vi.resetModules();
});

describe("Mongo client recovery", () => {
    it("replaces the closed client and hands out fresh collection handles", async () => {
        const { databaseController } = await import(
            "@/api-server/mongo-db-controller"
        );

        const before = databaseController.client;
        expect(constructed).toHaveLength(1);

        // Same client while it is healthy — no needless pool churn.
        expect(databaseController.client).toBe(before);

        // Caching a handle in the constructor was the actual defect: the
        // collection kept pointing at the dead client no matter how many times
        // the client was replaced.
        const staleEvents = databaseController.events as unknown as {
            client: unknown;
        };

        constructed[0].destroyed = true;

        const after = databaseController.client;
        expect(after).not.toBe(before);
        expect(constructed).toHaveLength(2);

        const freshEvents = databaseController.events as unknown as {
            client: unknown;
        };
        expect(freshEvents.client).not.toBe(staleEvents.client);
        expect(freshEvents.client).toBe(after);
    });
});
