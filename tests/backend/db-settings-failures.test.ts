import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/api-server/mongo-db-controller", () => ({
    databaseController: {
        settings: {
            findOne: vi.fn(),
            updateOne: vi.fn(),
        },
    },
}));
vi.mock("@/api-server/web-socket-utils", () => ({
    SendServerRequestToSessionServer: vi.fn(),
}));

import { databaseController } from "@/api-server/mongo-db-controller";
import { DbSettings } from "@/api-server/db-settings";
import { SendServerRequestToSessionServer } from "@/api-server/web-socket-utils";
import { PRAYER_TIMES_SETTING_KEY } from "@/api-shared/types/settings/prayer";

function makeController() {
    return {
        settings: {
            findOne: vi.fn(),
            updateOne: vi.fn(),
        },
    };
}

describe("DbSettings - Failure Paths", () => {
    let controller: ReturnType<typeof makeController>;
    // `DbSettings.init` always uses the real `databaseController` singleton
    // (it never accepts a controller param), so its tests mock that directly.
    const singletonSettings = databaseController.settings as unknown as {
        findOne: ReturnType<typeof vi.fn>;
        updateOne: ReturnType<typeof vi.fn>;
    };

    beforeEach(() => {
        controller = makeController();
        vi.clearAllMocks();
    });

    describe("getDbSetting", () => {
        it("returns null when setting not found", async () => {
            controller.settings.findOne.mockResolvedValueOnce(null);

            const result = await DbSettings.get("prayer_times", {}, controller as any);
            expect(result).toBeNull();
        });

        it("throws error when database fails", async () => {
            const dbError = new Error("Database connection lost");
            controller.settings.findOne.mockRejectedValueOnce(dbError);

            await expect(
                DbSettings.get("prayer_times", {}, controller as any)
            ).rejects.toThrow("Database connection lost");
        });

        it("returns null when findOne returns undefined", async () => {
            controller.settings.findOne.mockResolvedValueOnce(undefined);

            const result = await DbSettings.get("prayer_times", {}, controller as any);
            expect(result).toBeNull();
        });

        it("extracts value correctly from valid document", async () => {
            const settingValue = {
                arvit: new Date("1970-01-01T18:00:00Z"),
                mincha: new Date("1970-01-01T12:00:00Z"),
                shacharit: new Date("1970-01-01T06:00:00Z"),
            };

            controller.settings.findOne.mockResolvedValueOnce({
                _id: "some-id",
                key: PRAYER_TIMES_SETTING_KEY,
                value: settingValue,
            });

            const result = await DbSettings.get(
                PRAYER_TIMES_SETTING_KEY,
                {},
                controller as any
            );
            expect(result).toEqual(settingValue);
        });
    });

    describe("setDbSetting", () => {
        it("throws error when database updateOne fails", async () => {
            const dbError = new Error("Update operation failed");
            controller.settings.updateOne.mockRejectedValueOnce(dbError);

            await expect(
                DbSettings.set("prayer_times", {}, {}, controller as any)
            ).rejects.toThrow("Update operation failed");
        });

        it("sends websocket notification on successful update", async () => {
            controller.settings.updateOne.mockResolvedValueOnce({ ok: 1 });

            await DbSettings.set(
                PRAYER_TIMES_SETTING_KEY,
                { arvit: new Date() },
                {},
                controller as any
            );

            expect(SendServerRequestToSessionServer).toHaveBeenCalled();
            const [messageType, payload] = vi.mocked(
                SendServerRequestToSessionServer
            ).mock.calls[0];
            expect(payload).toHaveProperty("settings");
        });

        it("handles partial setting updates", async () => {
            controller.settings.updateOne.mockResolvedValueOnce({ ok: 1 });

            const partialSetting = { arvit: new Date("1970-01-01T19:00:00Z") };
            await DbSettings.set("prayer_times", partialSetting, {}, controller as any);

            expect(controller.settings.updateOne).toHaveBeenCalledWith(
                { key: "prayer_times" },
                { $set: { value: partialSetting } },
                {}
            );
        });

        it("sends websocket notification even if no documents matched", async () => {
            controller.settings.updateOne.mockResolvedValueOnce({
                matchedCount: 0,
                modifiedCount: 0,
            });

            await DbSettings.set("prayer_times", {}, {}, controller as any);

            expect(SendServerRequestToSessionServer).toHaveBeenCalled();
        });
    });

    describe("initDbSettings", () => {
        it("initializes prayer times when not already set", async () => {
            singletonSettings.findOne.mockResolvedValueOnce(null);
            singletonSettings.updateOne.mockResolvedValueOnce({ ok: 1 });

            await DbSettings.init();

            expect(singletonSettings.findOne).toHaveBeenCalledWith(
                { key: PRAYER_TIMES_SETTING_KEY },
                undefined
            );
            expect(singletonSettings.updateOne).toHaveBeenCalled();
        });

        it("skips initialization if prayer times already exist", async () => {
            const existingSetting = {
                _id: "id",
                key: PRAYER_TIMES_SETTING_KEY,
                value: {
                    arvit: new Date(),
                    mincha: new Date(),
                    shacharit: new Date(),
                },
            };
            singletonSettings.findOne.mockResolvedValueOnce(existingSetting);

            await DbSettings.init();

            expect(singletonSettings.findOne).toHaveBeenCalled();
            expect(singletonSettings.updateOne).not.toHaveBeenCalled();
        });

        it("throws error when database check fails", async () => {
            const dbError = new Error("Database unreachable");
            singletonSettings.findOne.mockRejectedValueOnce(dbError);

            await expect(DbSettings.init()).rejects.toThrow(
                "Database unreachable"
            );
        });

        it("throws error when initialization update fails", async () => {
            singletonSettings.findOne.mockResolvedValueOnce(null);
            const updateError = new Error("Insert failed");
            singletonSettings.updateOne.mockRejectedValueOnce(updateError);

            await expect(DbSettings.init()).rejects.toThrow("Insert failed");
        });

        it("uses upsert option during initialization", async () => {
            singletonSettings.findOne.mockResolvedValueOnce(null);
            singletonSettings.updateOne.mockResolvedValueOnce({ ok: 1 });

            await DbSettings.init();

            const [, , updateObj] = vi.mocked(singletonSettings.updateOne).mock
                .calls[0];
            expect(updateObj).toHaveProperty("upsert", true);
        });
    });

    describe("Edge Cases", () => {
        it("handles null database controller gracefully", async () => {
            await expect(DbSettings.get("prayer_times", {}, null as any)).rejects
                .toBeDefined();
        });

        it("handles setting with empty value", async () => {
            controller.settings.findOne.mockResolvedValueOnce({
                _id: "id",
                key: "empty_setting",
                value: {},
            });

            const result = await DbSettings.get("empty_setting", {}, controller as any);
            expect(result).toEqual({});
        });

        it("passes through database options to findOne", async () => {
            controller.settings.findOne.mockResolvedValueOnce(null);
            const options = { session: "some-session" };

            await DbSettings.get("prayer_times", options, controller as any);

            expect(controller.settings.findOne).toHaveBeenCalledWith(
                { key: "prayer_times" },
                options
            );
        });

        it("passes through database options to updateOne", async () => {
            controller.settings.updateOne.mockResolvedValueOnce({ ok: 1 });
            const options = { session: "some-session" };

            await DbSettings.set("prayer_times", {}, options, controller as any);

            expect(controller.settings.updateOne).toHaveBeenCalledWith(
                { key: "prayer_times" },
                { $set: { value: {} } },
                options
            );
        });
    });
});
