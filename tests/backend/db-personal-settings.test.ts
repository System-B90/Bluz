import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/api-server/mongo-db-controller", () => ({
    getMetaController: vi.fn(),
}));

import { getMetaController } from "@/api-server/mongo-db-controller";
import { DbPersonalSettings } from "@/api-server/db-personal-settings";

process.env.NEXTAUTH_SECRET ??= "test-secret-for-personal-settings-encryption";

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
            aiAssistantEnabled: true,
            aiApiToken: "",
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
            aiAssistantEnabled: true,
            aiApiToken: "",
        });
    });

    it("respects a stored aiAssistantEnabled: false", async () => {
        controller.personalSettings.findOne.mockResolvedValueOnce({
            userId: "u1",
            groups: [],
            instructors: [],
            favoriteOutsiders: [],
            aiAssistantEnabled: false,
        });
        const result = await DbPersonalSettings.get("u1");
        expect(result.aiAssistantEnabled).toBe(false);
    });

    it("respects a stored aiApiToken", async () => {
        controller.personalSettings.findOne.mockResolvedValueOnce({
            userId: "u1",
            groups: [],
            instructors: [],
            favoriteOutsiders: [],
            aiApiToken: "sk-or-test",
        });
        const result = await DbPersonalSettings.get("u1");
        expect(result.aiApiToken).toBe("sk-or-test");
    });

    it("encrypts aiApiToken at rest, and decrypts it back on get", async () => {
        await DbPersonalSettings.set("u1", {
            groups: [],
            instructors: [],
            favoriteOutsiders: [],
            aiApiToken: "sk-or-plaintext",
        } as never);

        const storedCall = controller.personalSettings.updateOne.mock.calls[0];
        const storedToken = storedCall[1].$set.aiApiToken;
        expect(storedToken).not.toBe("sk-or-plaintext");
        expect(storedToken).toMatch(/^enc:v1:/);

        controller.personalSettings.findOne.mockResolvedValueOnce({
            userId: "u1",
            groups: [],
            instructors: [],
            favoriteOutsiders: [],
            aiApiToken: storedToken,
        });
        const result = await DbPersonalSettings.get("u1");
        expect(result.aiApiToken).toBe("sk-or-plaintext");
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
            { $set: { userId: "u1", ...settings, aiApiToken: "" } },
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
                    aiApiToken: "",
                },
            },
            { upsert: true },
        );
    });
});
