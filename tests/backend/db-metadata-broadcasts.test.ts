import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Broadcast coverage for DbCourses / DbRooms / DbOutsiders (#650 follow-up).
 *
 * `db-custom-colors.test.ts` already does this for custom colors, and
 * `db-settings-failures.test.ts` touches it for settings, but courses, rooms
 * and outsiders had no unit coverage of their `SendServerRequestToSessionServer`
 * calls at all — the relay's unscoped ("everyone") fan-out for these message
 * types is pinned separately in `ws-unscoped-broadcasts.test.ts`, but nothing
 * asserted the app code actually calls it with the right type/payload for
 * each of create/update/delete. A broken call here (wrong type, or a payload
 * that silently stopped including the changed document) would ship with the
 * relay itself looking perfectly healthy.
 */

vi.mock("@/api-server/mongo-db-controller", () => ({
    databaseController: {},
}));
vi.mock("@/api-server/web-socket-utils", () => ({
    // The student refresh ping (#656) is a second network side effect on the
    // same write paths; stubbed alongside the broadcast.
    NotifyStudentsOfCalendarChange: vi.fn(),
    SendServerRequestToSessionServer: vi.fn(),
}));

import { DbCourses } from "@/api-server/db-courses";
import { DbOutsiders } from "@/api-server/db-outsiders";
import { DbRooms } from "@/api-server/db-rooms";
import { SendServerRequestToSessionServer } from "@/api-server/web-socket-utils";
import { MessageTypes } from "@/settings";

beforeEach(() => vi.clearAllMocks());

function makeCollectionController(collectionName: string) {
    return {
        [collectionName]: {
            find: vi.fn(() => ({ toArray: vi.fn(async () => []) })),
            updateOne: vi.fn(async () => ({ matchedCount: 1 })),
            insertOne: vi.fn(async () => ({ acknowledged: true })),
            deleteOne: vi.fn(async () => ({ deletedCount: 1 })),
        },
    };
}

describe("DbCourses broadcasts", () => {
    const controller = makeCollectionController("courses");
    const course = { id: "c1", name: "מתמטיקה", color: "#00f" };

    it("broadcasts COURSES_UPDATE, unscoped, on create", async () => {
        await DbCourses.create(course as never, controller as never);
        expect(SendServerRequestToSessionServer).toHaveBeenCalledWith(
            MessageTypes.COURSES_UPDATE,
            { courses: { c1: course } },
        );
    });

    it("broadcasts the updated document on set", async () => {
        await DbCourses.set(course as never, undefined, controller as never);
        expect(SendServerRequestToSessionServer).toHaveBeenCalledWith(
            MessageTypes.COURSES_UPDATE,
            { courses: { c1: course } },
        );
    });

    it("broadcasts null for the deleted id, not the whole document", async () => {
        await DbCourses.del("c1", controller as never);
        expect(SendServerRequestToSessionServer).toHaveBeenCalledWith(
            MessageTypes.COURSES_UPDATE,
            { courses: { c1: null } },
        );
    });

    it("does not broadcast when the update matches nothing", async () => {
        const noMatch = makeCollectionController("courses");
        noMatch.courses.updateOne = vi.fn(async () => ({ matchedCount: 0 }));
        await expect(
            DbCourses.set(course as never, undefined, noMatch as never),
        ).rejects.toThrow();
        expect(SendServerRequestToSessionServer).not.toHaveBeenCalled();
    });
});

describe("DbRooms broadcasts", () => {
    const controller = makeCollectionController("rooms");
    const room = { id: "r1", name: "301" };

    it("broadcasts ROOMS_UPDATE, unscoped, on create", async () => {
        await DbRooms.create(room as never, controller as never);
        expect(SendServerRequestToSessionServer).toHaveBeenCalledWith(
            MessageTypes.ROOMS_UPDATE,
            { rooms: { r1: room } },
        );
    });

    it("broadcasts null for the deleted id on delete", async () => {
        await DbRooms.del("r1", controller as never);
        expect(SendServerRequestToSessionServer).toHaveBeenCalledWith(
            MessageTypes.ROOMS_UPDATE,
            { rooms: { r1: null } },
        );
    });
});

describe("DbOutsiders broadcasts", () => {
    const controller = makeCollectionController("outsiders");
    const outsider = { id: "o1", name: "אורח" };

    it("broadcasts OUTSIDERS_UPDATE, unscoped, on create", async () => {
        await DbOutsiders.create(outsider as never, controller as never);
        expect(SendServerRequestToSessionServer).toHaveBeenCalledWith(
            MessageTypes.OUTSIDERS_UPDATE,
            { outsiders: { o1: outsider } },
        );
    });

    it("broadcasts null for the deleted id on delete", async () => {
        await DbOutsiders.del("o1", controller as never);
        expect(SendServerRequestToSessionServer).toHaveBeenCalledWith(
            MessageTypes.OUTSIDERS_UPDATE,
            { outsiders: { o1: null } },
        );
    });
});
