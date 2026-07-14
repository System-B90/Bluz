import dayjs from "dayjs";
import { describe, expect, it, vi } from "vitest";

import {
    pushSelectedCollisionUpdates,
    reconcileCollisionStatesAfterPush,
} from "@/components/schedule/offline-dialogs/push-updates-dialog/utils";
import type { CollisionStates } from "@/components/schedule/offline-dialogs/push-updates-dialog/types";
import { EventType } from "@/components/schedule/types/event";
import type { Event } from "@/components/schedule/types/event";

function makeEvent(id: string, overrides: Partial<Event> = {}): Event {
    return {
        id,
        name: `Event ${id}`,
        subject: 1,
        hiveModule: 1,
        startTime: dayjs("2026-06-28T09:00:00"),
        endTime: dayjs("2026-06-28T10:00:00"),
        type: EventType.LECTURE,
        courses: [],
        rooms: [],
        instructors: [],
        lecturers: [],
        tags: [],
        notes: "",
        locked: false,
        hidden: false,
        required: false,
        personalTalk: false,
        ...overrides,
    };
}

function collisionStates(): CollisionStates {
    return {
        create1: {
            localModifiedEvent: makeEvent("create1"),
            capturedVersion: undefined,
            serverVersion: undefined,
            conflicting: false,
        },
        update1: {
            localModifiedEvent: makeEvent("update1", { name: "edited" }),
            capturedVersion: makeEvent("update1"),
            serverVersion: makeEvent("update1"),
            conflicting: false,
        },
        delete1: {
            localModifiedEvent: undefined,
            capturedVersion: makeEvent("delete1"),
            serverVersion: makeEvent("delete1"),
            conflicting: false,
        },
    };
}

describe("pushSelectedCollisionUpdates (#157)", () => {
    it("routes each edit to the right op and reports all succeeded", async () => {
        const api = {
            createEvent: vi.fn().mockResolvedValue(undefined),
            updateEvent: vi.fn().mockResolvedValue(undefined),
            deleteEvent: vi.fn().mockResolvedValue(undefined),
        };

        const { succeededIds, failedIds } = await pushSelectedCollisionUpdates(
            collisionStates(),
            ["create1", "update1", "delete1"],
            api,
        );

        expect(api.createEvent).toHaveBeenCalledTimes(1);
        expect(api.updateEvent).toHaveBeenCalledTimes(1);
        expect(api.deleteEvent).toHaveBeenCalledWith("delete1");
        expect(succeededIds).toEqual(["create1", "update1", "delete1"]);
        expect(failedIds).toEqual([]);
    });

    it("keeps going after a mid-loop failure instead of aborting the batch", async () => {
        const api = {
            createEvent: vi.fn().mockResolvedValue(undefined),
            // The update fails; create (before) and delete (after) still run.
            updateEvent: vi.fn().mockRejectedValue(new Error("boom")),
            deleteEvent: vi.fn().mockResolvedValue(undefined),
        };

        const { succeededIds, failedIds } = await pushSelectedCollisionUpdates(
            collisionStates(),
            ["create1", "update1", "delete1"],
            api,
        );

        expect(api.createEvent).toHaveBeenCalledTimes(1);
        expect(api.deleteEvent).toHaveBeenCalledTimes(1);
        expect(succeededIds).toEqual(["create1", "delete1"]);
        expect(failedIds).toEqual(["update1"]);
    });
});

describe("reconcileCollisionStatesAfterPush (#157)", () => {
    it("drops resolved items so only failed ones remain pending", () => {
        const remaining = reconcileCollisionStatesAfterPush(collisionStates(), [
            "create1",
            "delete1",
        ]);
        expect(Object.keys(remaining)).toEqual(["update1"]);
    });
});
