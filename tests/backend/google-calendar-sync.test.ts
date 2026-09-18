import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { logger } from "@/logging/pino";

// vi.resetModules() below hands each dynamic import a fresh module graph, so a
// spy on the real pino instance would watch a different object than the module
// under test uses. Mocking the module keeps one shared logger across them.
vi.mock("@/logging/pino", () => ({
    logger: {
        debug: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
    },
}));

/**
 * Unit tests for the fire-and-forget Google Calendar sync fan-out: which
 * *calendars* an event is mirrored to (grouping the opted-in users' links by
 * calendar, so a calendar several users share receives each event once),
 * how a link's bound iteration gates it, the failover between links on one
 * calendar, the delete-on-scope-exit for updates, and the per-user
 * background-pull throttle. The service layer is mocked at its boundary; the
 * never-throws contract is the point — a Google outage must never touch the
 * Bluz event write it hangs off.
 */

const { pushService, personalSettings } = vi.hoisted(() => ({
    pushService: {
        pushEventToGoogle: vi.fn(async () => true),
        pullEventEdits: vi.fn(async () => 0),
        listGoogleCalendarLinks: vi.fn(async () => [] as Array<unknown>),
    },
    personalSettings: {
        find: vi.fn(() => ({ toArray: async () => [] as Array<unknown> })),
    },
}));

vi.mock("@/api-server/google/google-calendar-service", () => ({
    pushEventToGoogle: pushService.pushEventToGoogle,
    pullEventEdits: pushService.pullEventEdits,
    listGoogleCalendarLinks: pushService.listGoogleCalendarLinks,
}));
vi.mock("@/api-server/mongo-db-controller", () => ({
    getMetaController: vi.fn(() => ({ personalSettings })),
}));

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

const settings = (userId: string, syncAll = false) => ({
    userId,
    googleCalendarEnabled: true,
    googleCalendarSyncAllEvents: syncAll,
});
const link = (userId: string, calendarId: string, iterationId?: string) => ({
    userId,
    calendarId,
    ...(iterationId ? { iterationId } : {}),
});

function arrange(
    settingsDocs: Array<ReturnType<typeof settings>>,
    links: Array<ReturnType<typeof link>>,
) {
    personalSettings.find.mockReturnValue({ toArray: async () => settingsDocs });
    pushService.listGoogleCalendarLinks.mockResolvedValue(links);
}

const flushAsyncWork = () =>
    new Promise<void>((resolve) => setTimeout(resolve, 0));

const pushedTo = () =>
    pushService.pushEventToGoogle.mock.calls.map(
        ([userId, , action]) => `${userId}:${action}`,
    );

beforeEach(() => {
    // Fresh module per case: the pull throttle lives in a module-level map.
    vi.resetModules();
    vi.clearAllMocks();
    pushService.pushEventToGoogle.mockResolvedValue(true);
    arrange([], []);
});

describe("syncEventToInstructorsGoogleCalendars", () => {
    const importSync = async () =>
        await import("@/api-server/google/google-calendar-sync");

    it("loads every opted-in user, then only their links", async () => {
        const { syncEventToInstructorsGoogleCalendars } = await importSync();
        arrange([settings("1"), settings("9")], []);

        syncEventToInstructorsGoogleCalendars(event, "upsert");
        await flushAsyncWork();

        expect(personalSettings.find).toHaveBeenCalledWith({
            googleCalendarEnabled: true,
        });
        expect(pushService.listGoogleCalendarLinks).toHaveBeenCalledWith(["1", "9"]);
    });

    it("skips the link lookup entirely when nobody opted in", async () => {
        const { syncEventToInstructorsGoogleCalendars } = await importSync();

        syncEventToInstructorsGoogleCalendars(event, "upsert");
        await flushAsyncWork();

        expect(pushService.listGoogleCalendarLinks).not.toHaveBeenCalled();
        expect(pushService.pushEventToGoogle).not.toHaveBeenCalled();
    });

    it("pushes once per calendar: an assigned instructor's, a lecturer's, and a sync-all user's", async () => {
        const { syncEventToInstructorsGoogleCalendars } = await importSync();
        arrange(
            [settings("1"), settings("3"), settings("9", true), settings("5")],
            [link("1", "cal-1"), link("3", "cal-3"), link("9", "cal-9"), link("5", "cal-5")],
        );

        syncEventToInstructorsGoogleCalendars(event, "upsert", "2026a");
        await flushAsyncWork();

        // User 5 is neither assigned nor sync-all: their calendar is untouched.
        expect(pushedTo().sort()).toEqual(["1:upsert", "3:upsert", "9:upsert"]);
        // pushEventToGoogle(userId, event, action, iterationId).
        expect(pushService.pushEventToGoogle).toHaveBeenCalledWith(
            "1",
            event,
            "upsert",
            "2026a",
        );
    });

    it("writes a shared calendar exactly once however many users point at it", async () => {
        const { syncEventToInstructorsGoogleCalendars } = await importSync();
        arrange(
            [settings("1"), settings("2"), settings("9", true)],
            [link("1", "shared"), link("2", "shared"), link("9", "shared")],
        );

        syncEventToInstructorsGoogleCalendars(event, "upsert");
        await flushAsyncWork();

        expect(pushService.pushEventToGoogle).toHaveBeenCalledTimes(1);
    });

    it("a shared calendar gets the event when any of its users qualifies", async () => {
        const { syncEventToInstructorsGoogleCalendars } = await importSync();
        // User 5 is unassigned; user 1 is an instructor. Both on "shared".
        arrange([settings("5"), settings("1")], [link("5", "shared"), link("1", "shared")]);

        syncEventToInstructorsGoogleCalendars(event, "upsert");
        await flushAsyncWork();

        expect(pushService.pushEventToGoogle).toHaveBeenCalledTimes(1);
    });

    it("fails over to the next link on the same calendar when the first push is refused", async () => {
        const { syncEventToInstructorsGoogleCalendars } = await importSync();
        arrange([settings("1"), settings("2")], [link("1", "shared"), link("2", "shared")]);
        // User 1 revoked Bluz in their Google account → the push is a no-op.
        pushService.pushEventToGoogle
            .mockResolvedValueOnce(false)
            .mockResolvedValueOnce(true);

        syncEventToInstructorsGoogleCalendars(event, "upsert");
        await flushAsyncWork();

        expect(pushedTo()).toEqual(["1:upsert", "2:upsert"]);
    });

    it("stops after the first link that works", async () => {
        const { syncEventToInstructorsGoogleCalendars } = await importSync();
        arrange(
            [settings("1"), settings("2"), settings("3")],
            [link("1", "shared"), link("2", "shared"), link("3", "shared")],
        );

        syncEventToInstructorsGoogleCalendars(event, "delete");
        await flushAsyncWork();

        expect(pushedTo()).toEqual(["1:delete"]);
    });

    it("leaves a calendar bound to another iteration alone", async () => {
        const { syncEventToInstructorsGoogleCalendars } = await importSync();
        arrange(
            [settings("1"), settings("2")],
            [link("1", "cal-old", "2025b"), link("2", "cal-now", "2026a")],
        );

        syncEventToInstructorsGoogleCalendars(event, "upsert", "2026a");
        await flushAsyncWork();

        expect(pushedTo()).toEqual(["2:upsert"]);
    });

    it("treats an unbound (legacy) link as matching any iteration", async () => {
        const { syncEventToInstructorsGoogleCalendars } = await importSync();
        arrange([settings("1")], [link("1", "cal-legacy")]);

        syncEventToInstructorsGoogleCalendars(event, "upsert", "2026a");
        await flushAsyncWork();

        expect(pushedTo()).toEqual(["1:upsert"]);
    });

    it("does not gate on iteration when the write carries none", async () => {
        const { syncEventToInstructorsGoogleCalendars } = await importSync();
        arrange([settings("1")], [link("1", "cal-1", "2025b")]);

        syncEventToInstructorsGoogleCalendars(event, "upsert");
        await flushAsyncWork();

        expect(pushedTo()).toEqual(["1:upsert"]);
    });

    it("deletes from every calendar on a delete, assigned or not", async () => {
        const { syncEventToInstructorsGoogleCalendars } = await importSync();
        // User 5 never qualified for this event — but a delete is cheap and
        // a stale copy is worse than a 404.
        arrange([settings("1"), settings("5")], [link("1", "cal-1"), link("5", "cal-5")]);

        syncEventToInstructorsGoogleCalendars(event, "delete", "2026a");
        await flushAsyncWork();

        expect(pushedTo().sort()).toEqual(["1:delete", "5:delete"]);
    });

    it("on an update, removes the event from a calendar that wanted the old assignment only", async () => {
        const { syncEventToInstructorsGoogleCalendars } = await importSync();
        arrange([settings("1"), settings("7")], [link("1", "cal-1"), link("7", "cal-7")]);
        const previous = { ...event, instructors: [7], lecturers: [] };
        const updated = { ...event, instructors: [1], lecturers: [] };

        syncEventToInstructorsGoogleCalendars(updated, "upsert", "2026a", previous);
        await flushAsyncWork();

        expect(pushedTo().sort()).toEqual(["1:upsert", "7:delete"]);
    });

    it("on an update, ignores calendars that wanted neither version", async () => {
        const { syncEventToInstructorsGoogleCalendars } = await importSync();
        arrange([settings("1"), settings("5")], [link("1", "cal-1"), link("5", "cal-5")]);
        const previous = { ...event, instructors: [1], lecturers: [] };

        syncEventToInstructorsGoogleCalendars(event, "upsert", "2026a", previous);
        await flushAsyncWork();

        expect(pushedTo()).toEqual(["1:upsert"]);
    });

    it("without a previous version, never issues speculative deletes", async () => {
        const { syncEventToInstructorsGoogleCalendars } = await importSync();
        arrange([settings("5")], [link("5", "cal-5")]);

        syncEventToInstructorsGoogleCalendars(event, "upsert");
        await flushAsyncWork();

        expect(pushService.pushEventToGoogle).not.toHaveBeenCalled();
    });

    it("ignores opted-in users who never linked an account", async () => {
        const { syncEventToInstructorsGoogleCalendars } = await importSync();
        arrange([settings("1"), settings("2")], [link("2", "cal-2")]);

        syncEventToInstructorsGoogleCalendars(event, "upsert");
        await flushAsyncWork();

        expect(pushedTo()).toEqual(["2:upsert"]);
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

        expect(logger.warn).toHaveBeenCalledWith(
            expect.objectContaining({ err: expect.anything() }),
            "Google Calendar sync skipped:",
        );
    });

    it("swallows a link-store failure instead of rejecting", async () => {
        const { syncEventToInstructorsGoogleCalendars } = await importSync();
        arrange([settings("1")], []);
        pushService.listGoogleCalendarLinks.mockRejectedValueOnce(
            new Error("mongo down"),
        );

        syncEventToInstructorsGoogleCalendars(event, "upsert");
        await flushAsyncWork();

        expect(logger.warn).toHaveBeenCalledWith(
            expect.objectContaining({ err: expect.anything() }),
            "Google Calendar sync skipped:",
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

        expect(logger.warn).toHaveBeenCalledWith(
            expect.objectContaining({ err: expect.anything() }),
            "Google Calendar background pull failed:",
        );

        // The failed attempt still consumed this window's slot.
        pullGoogleEditsInBackground("u1");
        expect(pushService.pullEventEdits).toHaveBeenCalledTimes(1);
    });
});
