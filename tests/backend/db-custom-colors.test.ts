import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/api-server/mongo-db-controller", () => ({
    getMetaController: vi.fn(),
}));
vi.mock("@/api-server/web-socket-utils", () => ({
    SendServerRequestToSessionServer: vi.fn(),
}));

import { getMetaController } from "@/api-server/mongo-db-controller";
import { DbCustomColors } from "@/api-server/db-custom-colors";
import { SendServerRequestToSessionServer } from "@/api-server/web-socket-utils";
import { MessageTypes } from "@/settings";

function makeController() {
    return {
        customColors: {
            find: vi.fn(() => ({
                toArray: vi.fn(async () => []),
            })),
            updateOne: vi.fn(async () => ({ matchedCount: 1 })),
            insertOne: vi.fn(async () => ({ acknowledged: true })),
            deleteOne: vi.fn(async () => ({ deletedCount: 1 })),
        },
    };
}

let controller: ReturnType<typeof makeController>;
beforeEach(() => {
    controller = makeController();
    vi.mocked(getMetaController).mockReturnValue(controller as never);
    vi.mocked(SendServerRequestToSessionServer).mockClear();
});

describe("DbCustomColors", () => {
    it("gets all colors", async () => {
        await DbCustomColors.get();
        expect(controller.customColors.find).toHaveBeenCalled();
    });

    it("creates color", async () => {
        const color = { id: "c1", name: "Red", hex: "#ff0000" };
        await DbCustomColors.create(color);
        expect(controller.customColors.insertOne).toHaveBeenCalledWith(color);
        expect(SendServerRequestToSessionServer).toHaveBeenCalledWith(
            MessageTypes.CUSTOM_COLORS_UPDATE,
            {}
        );
    });

    it("updates color", async () => {
        const color = { id: "c1", name: "Red Updated", hex: "#ee0000" };
        await DbCustomColors.set(color);
        expect(controller.customColors.updateOne).toHaveBeenCalledWith(
            { id: "c1" },
            { $set: { name: "Red Updated", hex: "#ee0000" } }
        );
        expect(SendServerRequestToSessionServer).toHaveBeenCalledWith(
            MessageTypes.CUSTOM_COLORS_UPDATE,
            {}
        );
    });

    it("deletes color", async () => {
        await DbCustomColors.del("c1");
        expect(controller.customColors.deleteOne).toHaveBeenCalledWith({ id: "c1" });
        expect(SendServerRequestToSessionServer).toHaveBeenCalledWith(
            MessageTypes.CUSTOM_COLORS_UPDATE,
            {}
        );
    });
});
