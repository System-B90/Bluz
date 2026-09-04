import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/api-server/web-socket-utils", () => ({
    SendServerRequestToSessionServer: vi.fn(),
}));
vi.mock("@/api-server/mongo-db-controller", () => ({
    databaseController: {},
    DatabaseController: class {},
}));

import { DbOutsiders } from "@/api-server/db-outsiders";
import { SendServerRequestToSessionServer } from "@/api-server/web-socket-utils";
import { ClientApiError } from "@/api-shared/errors";
import { Outsider } from "@/api-shared/types/outsider";
import { MessageTypes } from "@/settings";

/**
 * Outsider persistence. The two things worth pinning: writes are an explicit
 * field allow-list (#538 item 4), and every write broadcasts so other tabs
 * update instead of going stale.
 */
const outsider = {
    id: "o1",
    name: "איש חוץ",
    phone: "0501234567",
} as unknown as Outsider;

function controllerWith(overrides: Record<string, unknown> = {}) {
    const collection = {
        find: vi.fn(() => ({ toArray: async () => [ outsider ] })),
        updateOne: vi.fn(async () => ({ matchedCount: 1 })),
        insertOne: vi.fn(async () => ({ insertedId: "x" })),
        deleteOne: vi.fn(async () => ({ deletedCount: 1 })),
        ...overrides,
    };
    return { controller: { outsiders: collection } as never, collection };
}

beforeEach(() => vi.clearAllMocks());

describe("DbOutsiders.get", () => {
    it("reads them all through the supplied controller", async () => {
        const { controller, collection } = controllerWith();

        await expect(
            DbOutsiders.get(undefined, controller),
        ).resolves.toEqual([ outsider ]);
        expect(collection.find).toHaveBeenCalledWith({}, undefined);
    });
});

describe("DbOutsiders.set", () => {
    it("updates by id and broadcasts the new value", async () => {
        const { controller, collection } = controllerWith();

        await DbOutsiders.set(outsider, undefined, controller);

        const [ filter, update ] = collection.updateOne.mock.calls[ 0 ];
        expect(filter).toEqual({ id: "o1" });
        expect(update).toEqual({
            $set: { name: "איש חוץ", phone: "0501234567" },
        });
        expect(SendServerRequestToSessionServer).toHaveBeenCalledWith(
            MessageTypes.OUTSIDERS_UPDATE,
            { outsiders: { o1: outsider } },
        );
    });

    it("never writes the Mongo _id back into the document", async () => {
        const { controller, collection } = controllerWith();

        await DbOutsiders.set(
            { ...outsider, _id: "mongo-id" } as unknown as Outsider,
            undefined,
            controller,
        );

        expect(
            collection.updateOne.mock.calls[ 0 ][ 1 ].$set,
        ).not.toHaveProperty("_id");
    });

    it("rejects an update that matched nothing", async () => {
        const { controller } = controllerWith({
            updateOne: vi.fn(async () => ({ matchedCount: 0 })),
        });

        await expect(
            DbOutsiders.set(outsider, undefined, controller),
        ).rejects.toThrow(ClientApiError);
        expect(SendServerRequestToSessionServer).not.toHaveBeenCalled();
    });

    it("accepts a no-match upsert, which creates the row", async () => {
        const { controller } = controllerWith({
            updateOne: vi.fn(async () => ({ matchedCount: 0 })),
        });

        await expect(
            DbOutsiders.set(outsider, { upsert: true }, controller),
        ).resolves.toBeUndefined();
        expect(SendServerRequestToSessionServer).toHaveBeenCalled();
    });
});

describe("DbOutsiders.create", () => {
    it("stores only the allow-listed fields (#538 item 4)", async () => {
        const { controller, collection } = controllerWith();

        await DbOutsiders.create(
            {
                ...outsider,
                isAdmin: true,
                _id: "mongo-id",
            } as unknown as Outsider,
            controller,
        );

        const document = collection.insertOne.mock.calls[ 0 ][ 0 ];
        expect(document).not.toHaveProperty("isAdmin");
        expect(document).not.toHaveProperty("_id");
        expect(document.id).toBe("o1");
        expect(document.name).toBe("איש חוץ");
    });

    it("broadcasts the created outsider and returns it", async () => {
        const { controller } = controllerWith();

        await expect(
            DbOutsiders.create(outsider, controller),
        ).resolves.toEqual(outsider);
        expect(SendServerRequestToSessionServer).toHaveBeenCalledWith(
            MessageTypes.OUTSIDERS_UPDATE,
            { outsiders: { o1: outsider } },
        );
    });
});

describe("DbOutsiders.del", () => {
    it("broadcasts a null so listeners drop the row", async () => {
        const { controller, collection } = controllerWith();

        await DbOutsiders.del("o1", controller);

        expect(collection.deleteOne).toHaveBeenCalledWith({ id: "o1" });
        expect(SendServerRequestToSessionServer).toHaveBeenCalledWith(
            MessageTypes.OUTSIDERS_UPDATE,
            { outsiders: { o1: null } },
        );
    });

    it("rejects a delete that removed nothing, broadcasting nothing", async () => {
        const { controller } = controllerWith({
            deleteOne: vi.fn(async () => ({ deletedCount: 0 })),
        });

        await expect(DbOutsiders.del("o1", controller)).rejects.toThrow(
            ClientApiError,
        );
        expect(SendServerRequestToSessionServer).not.toHaveBeenCalled();
    });
});
