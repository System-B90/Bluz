import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/api-server/mongo-db-controller", () => ({
    getMetaController: vi.fn(),
}));

import { getMetaController } from "@/api-server/mongo-db-controller";
import { DbPersonalSettings } from "@/api-server/db-personal-settings";

function makeController() {
    return {
        personalSettings: {
            findOne: vi.fn(async () => null),
            updateOne: vi.fn(async () => ({ acknowledged: true })),
        },
    };
}

let controller: ReturnType<typeof makeController>;
beforeEach(() => {
    controller = makeController();
    vi.mocked(getMetaController).mockReturnValue(controller as never);
});

describe("DbPersonalSettings", () => {
    it("returns empty settings when no doc exists", async () => {
        const result = await DbPersonalSettings.get("u1");
        expect(controller.personalSettings.findOne).toHaveBeenCalledWith({
            userId: "u1",
        });
        expect(result).toEqual({
            groups: [],
            instructors: [],
            favoriteOutsiders: [],
            googleCalendarEnabled: false,
            googleCalendarSyncAllEvents: false,
        });
    });

    it("returns stored settings when a doc exists", async () => {
        controller.personalSettings.findOne.mockResolvedValueOnce({
            userId: "u1",
            groups: [ "g1" ],
            instructors: [ "i1" ],
            favoriteOutsiders: [ "o1" ],
            googleCalendarEnabled: true,
        });
        const result = await DbPersonalSettings.get("u1");
        expect(result).toEqual({
            groups: [ "g1" ],
            instructors: [ "i1" ],
            favoriteOutsiders: [ "o1" ],
            googleCalendarEnabled: true,
            googleCalendarSyncAllEvents: false,
        });
    });

    it("upserts settings on set", async () => {
        const settings = {
            groups: [ "g1" ],
            instructors: [],
            favoriteOutsiders: [],
        };
        const result = await DbPersonalSettings.set("u1", settings);
        expect(controller.personalSettings.updateOne).toHaveBeenCalledWith(
            { userId: "u1" },
            { $set: { userId: "u1", ...settings } },
            { upsert: true },
        );
        // A copy of what was stored, not the caller's object (#538 item 4).
        expect(result).toEqual(settings);
    });

    it("stores only known settings fields", async () => {
        await DbPersonalSettings.set("u1", {
            groups: [ "g1" ],
            instructors: [],
            favoriteOutsiders: [],
            somethingElse: "should not be stored",
        } as never);

        expect(controller.personalSettings.updateOne).toHaveBeenCalledWith(
            { userId: "u1" },
            {
                $set: {
                    favoriteOutsiders: [],
                    groups: [ "g1" ],
                    instructors: [],
                    userId: "u1",
                },
            },
            { upsert: true },
        );
    });
});
