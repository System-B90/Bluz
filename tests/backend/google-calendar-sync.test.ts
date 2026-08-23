import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Unit tests for the fire-and-forget Google Calendar sync fan-out: which
 * users an event is mirrored to (assigned instructors who opted in, plus
 * "sync everything" users), and the per-user background-pull throttle. The
 * service layer is mocked at its boundary; the never-throws contract is the
 * point — a Google outage must never touch the Bluz event write it hangs off.
 */

const { pushService, personalSettings } = vi.hoisted(() => ({
    pushService: {
        pushEventToGoogle: vi.fn(async () => undefined),
        pullEventEdits: vi.fn(async () => 0),
    },
    personalSettings: {
        find: vi.fn(() => ({ toArray: async () => [] })),
    },
}));

vi.mock("@/api-server/google/google-calendar-service", () => ({
    pushEventToGoogle: pushService.pushEventToGoogle,
    pullEventEdits: pushService.pullEventEdits,
}));
vi.mock("@/api-server/mongo-db-controller", () => ({
    getMetaController: vi.fn(() => ({ personalSettings })),
}));

import {
    pullGoogleEditsInBackground,
    syncEventToInstructorsGoogleCalendars,
} from "@/api-server/google/google-calendar-sync";
import { EventType } from "@/api-shared/types/event";

const event = {
    id: "e1",
    name: "שיעור",
    subject: 1,
    hiveModule: 7,
    type: EventType.LECTURE,
    startTime: new Date("2026-03-02T09:00:00Z"),
    endTime: new Date("2026-03-02T10:00:00Z"),
    courses: [],
    rooms: [],
    instructors: [1, 2],
    // An outsider lecturer (string id) must not be treated as a user id.
    lecturers: ["outsider-x", 3],
    tags: [],
    notes: "",
    locked: false,
    hidden: false,
    required: false,
    personalTalk: false,
    splitAcrossBreaks: false,
};

const flushAsyncWork = () =>
    new Promise<void>((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
    // Fresh module per case: the pull throttle lives in a module-level map.
    vi.resetModules();
    vi.clearAllMocks();
    vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("syncEventToInstructorsGoogleCalendars", () => {
    const importSync = async () =>
        await import("@/api-server/google/google-calendar-sync");

    it("queries only opted-in settings via the instructor ∪ sync-all filter", async () => {
        const { syncEventToInstructorsGoogleCalendars } = await importSync();
        personalSettings.find.mockReturnValueOnce({
            toArray: async () => [],
        });

        syncEventToInstructorsGoogleCalendars(event, "upsert");
        await flushAsyncWork();

        expect(personalSettings.find).toHaveBeenCalledWith({
            googleCalendarEnabled: true,
            $or: [
                {
                    userId: {
                        // Numeric instructors and lecturers, stringified and
                        // deduped; the outsider lecturer is dropped.
                        $in: ["1", "2", "3"],
                    },
                },
                { googleCalendarSyncAllEvents: true },
            ],
        });
    });

    it("pushes to every matching user with the action passed through", async () => {
        const { syncEventToInstructorsGoogleCalendars } = await importSync();
        personalSettings.find.mockReturnValueOnce({
            toArray: async () => [{ userId: "1" }, { userId: "9" }],
        });

        syncEventToInstructorsGoogleCalendars(event, "delete");
        await flushAsyncWork();

        expect(pushService.pushEventToGoogle).toHaveBeenCalledTimes(2);
        expect(pushService.pushEventToGoogle).toHaveBeenCalledWith(
            "1",
            event,
            "delete",
        );
        expect(pushService.pushEventToGoogle).toHaveBeenCalledWith(
            "9",
            event,
            "delete",
        );
    });

    it("swallows a settings-store failure instead of rejecting", async () => {
        const { syncEventToInstructorsGoogleCalendars } = await importSync();
        personalSettings.find.mockImplementationOnce(() => {
            throw new Error("mongo down");
        });

        // Fire-and-forget: the call itself returns synchronously, whatever
        // happens underneath.
        expect(() =>
            syncEventToInstructorsGoogleCalendars(event, "upsert"),
        ).not.toThrow();
        await flushAsyncWork();

        expect(console.warn).toHaveBeenCalledWith(
            "Google Calendar sync skipped:",
            expect.anything(),
        );
    });
});

describe("pullGoogleEditsInBackground", () => {
    const importSync = async () =>
        await import("@/api-server/google/google-calendar-sync");

    afterEach(() => {
        vi.useRealTimers();
    });

    it("pulls immediately on the first request for a user", async () => {
        const { pullGoogleEditsInBackground } = await importSync();

        pullGoogleEditsInBackground("u1");
        await flushAsyncWork();

        expect(pushService.pullEventEdits).toHaveBeenCalledTimes(1);
        expect(pushService.pullEventEdits).toHaveBeenCalledWith("u1");
    });

    it("throttles repeat requests within five minutes", async () => {
        const { pullGoogleEditsInBackground } = await importSync();
        vi.useFakeTimers({ now: new Date("2026-01-01T00:00:00Z") });

        pullGoogleEditsInBackground("u1"); // pulls
        pullGoogleEditsInBackground("u1"); // throttled
        vi.advanceTimersByTime(4 * 60_000);
        pullGoogleEditsInBackground("u1"); // still inside the window
        vi.advanceTimersByTime(60_001);
        pullGoogleEditsInBackground("u1"); // window elapsed → pulls again

        expect(pushService.pullEventEdits).toHaveBeenCalledTimes(2);
    });

    it("throttles per user, not globally", async () => {
        const { pullGoogleEditsInBackground } = await importSync();

        pullGoogleEditsInBackground("u1");
        pullGoogleEditsInBackground("u2");
        await flushAsyncWork();

        expect(pushService.pullEventEdits).toHaveBeenNthCalledWith(1, "u1");
        expect(pushService.pullEventEdits).toHaveBeenNthCalledWith(2, "u2");
    });

    it("keeps the throttle armed even when a pull fails", async () => {
        const { pullGoogleEditsInBackground } = await importSync();
        pushService.pullEventEdits.mockRejectedValueOnce(
            new Error("google down"),
        );

        pullGoogleEditsInBackground("u1");
        await flushAsyncWork();

        expect(console.warn).toHaveBeenCalledWith(
            "Google Calendar background pull failed:",
            expect.anything(),
        );

        // The failed attempt still consumed this window's slot.
        pullGoogleEditsInBackground("u1");
        expect(pushService.pullEventEdits).toHaveBeenCalledTimes(1);
    });
});
