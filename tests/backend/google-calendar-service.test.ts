import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Unit tests for the Google Calendar integration, with the `googleapis` client
 * and the Mongo controllers fully mocked — nothing here touches the network or
 * a database. The contracts under test are the ones the rest of Bluz relies
 * on: tokens are sealed before persistence, the GIS popup code is redeemed
 * against the reserved "postmessage" redirect_uri, and every push/pull path is
 * a safe no-op (never a rejection) when Google is unreachable.
 */

const { gapi, links, dbEvent, dbIterations } = vi.hoisted(() => {
    /** Every API surface the service reaches for, as one shared fake. */
    const calendarApi = {
        calendarList: {
            list: vi.fn(async () => ({ data: { items: [] } })),
        },
        calendars: {
            insert: vi.fn(async () => ({ data: { id: "cal-new" } })),
            patch: vi.fn(async () => ({ data: {} })),
        },
        events: {
            list: vi.fn(async () => ({ data: {} })),
            update: vi.fn(async () => ({ data: {} })),
            insert: vi.fn(async () => ({ data: { id: "g-inserted" } })),
            delete: vi.fn(async () => ({ data: {} })),
        },
        freebusy: {
            query: vi.fn(async () => ({
                data: { calendars: { primary: { busy: [] } } },
            })),
        },
    };

    class FakeOAuth2 {
        public clientId?: string;
        public clientSecret?: string;
        public redirectUri?: string;
        public credentials: Record<string, unknown> = {};
        public tokenHandlers: Array<(tokens: Record<string, unknown>) => void> =
            [];
        public getToken = vi.fn(async () => ({ tokens: state.nextTokens }));

        constructor(
            clientId?: string,
            clientSecret?: string,
            redirectUri?: string,
        ) {
            this.clientId = clientId;
            this.clientSecret = clientSecret;
            this.redirectUri = redirectUri;
            state.oauthInstances.push(this);
        }

        setCredentials(credentials: Record<string, unknown>) {
            this.credentials = credentials;
        }

        on(event: string, handler: (tokens: Record<string, unknown>) => void) {
            if (event === "tokens") this.tokenHandlers.push(handler);
        }

        /** Test hook: pretend Google pushed rotated credentials. */
        emitTokens(tokens: Record<string, unknown>) {
            for (const handler of this.tokenHandlers) handler(tokens);
        }
    }

    const state = {
        oauthInstances: [] as Array<InstanceType<typeof FakeOAuth2>>,
        /** Tokens returned by the next getToken() call. */
        nextTokens: {
            access_token: "access-token",
            refresh_token: "refresh-token",
            expiry_date: 1_900_000_000_000,
        },
        api: calendarApi,
        OAuth2: FakeOAuth2,
    };

    return {
        gapi: {
            oauthInstances: state.oauthInstances,
            nextTokens: state.nextTokens,
            api: calendarApi,
            google: {
                auth: { OAuth2: FakeOAuth2 },
                calendar: vi.fn(() => calendarApi),
            },
        },
        links: {
            findOne: vi.fn(),
            updateOne: vi.fn(async () => undefined),
            deleteOne: vi.fn(async () => undefined),
        },
        dbEvent: {
            get: vi.fn(),
            set: vi.fn(async () => undefined),
        },
        dbIterations: {
            currentOrNull: vi.fn(),
        },
    };
});

// Module-level constants bake these in at import time, so they must be set
// before the service module is first loaded.
vi.hoisted(() => {
    process.env.GOOGLE_CLIENT_ID = "test-client-id.apps.googleusercontent.com";
    process.env.GOOGLE_CLIENT_SECRET = "test-client-secret";
    process.env.SYM_ENC_KEY = "ab".repeat(32);
});

vi.mock("googleapis", () => ({
    calendar_v3: {},
    google: gapi.google,
}));
vi.mock("@/api-server/db-event", () => ({ DbEvent: dbEvent }));
vi.mock("@/api-server/db-iterations", () => ({ DbIterations: dbIterations }));
vi.mock("@/api-server/mongo-db-controller", () => ({
    getMetaController: vi.fn(() => ({
        googleCalendarLinks: {
            findOne: links.findOne,
            updateOne: links.updateOne,
            deleteOne: links.deleteOne,
        },
    })),
}));

import * as service from "@/api-server/google/google-calendar-service";
import { openSecret, sealSecret } from "@/api-server/secret-box";
import { EventType } from "@/api-shared/types/event";
import { EventChangeInitiator } from "@/api-shared/types/event-history";
import type { GoogleCalendarLink } from "@/api-shared/types/google-calendar";

const ITERATION_LABEL = "מחזור תשפ״ו";

/** Builds a stored link whose sealed tokens round-trip back to plaintext. */
function makeLink(overrides: Partial<GoogleCalendarLink> = {}) {
    return {
        userId: "u1",
        accessToken: sealSecret("access-token"),
        refreshToken: sealSecret("refresh-token"),
        expiryDate: 1_800_000_000_000,
        calendarId: "cal-bluz",
        connectedAt: 1_700_000_000_000,
        ...overrides,
    };
}

const baseEvent = {
    id: "abc-def-123",
    name: "שיעור",
    subject: 1,
    hiveModule: 7,
    type: EventType.LECTURE,
    startTime: new Date("2026-03-02T09:00:00Z"),
    endTime: new Date("2026-03-02T10:00:00Z"),
    courses: [],
    rooms: [],
    instructors: [],
    tags: [],
    notes: "",
    locked: false,
    hidden: false,
    required: false,
    personalTalk: false,
    splitAcrossBreaks: false,
};

const eventFixture = (overrides: Record<string, unknown> = {}) =>
    ({ ...baseEvent, ...overrides }) as typeof baseEvent;

/** Total calls across every faked Calendar API method. */
function totalApiCalls(): number {
    return Object.values(gapi.api)
        .flatMap((group) =>
            Object.values(
                group as Record<string, { mock: { calls: Array<unknown> } }>,
            ),
        )
        .reduce((sum, fn) => sum + fn.mock.calls.length, 0);
}

const lastClient = () => gapi.oauthInstances[gapi.oauthInstances.length - 1];

const flushAsyncWork = () =>
    new Promise<void>((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
    vi.clearAllMocks();
    gapi.nextTokens.access_token = "access-token";
    gapi.nextTokens.refresh_token = "refresh-token";
    gapi.nextTokens.expiry_date = 1_900_000_000_000;
    links.findOne.mockResolvedValue(makeLink());
    dbEvent.get.mockResolvedValue(null);
    dbEvent.set.mockResolvedValue(undefined);
    dbIterations.currentOrNull.mockResolvedValue({
        label: ITERATION_LABEL,
    });
    vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
    vi.restoreAllMocks();
});

/** Loads a fresh copy of the module with no OAuth client configured. */
async function loadUnconfigured() {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    try {
        vi.resetModules();
        return await import("@/api-server/google/google-calendar-service");
    } finally {
        process.env.GOOGLE_CLIENT_ID = clientId;
        process.env.GOOGLE_CLIENT_SECRET = clientSecret;
    }
}

describe("configuration surface", () => {
    it("reports itself configured while both credentials exist", () => {
        expect(service.isGoogleCalendarConfigured()).toBe(true);
        expect(service.getGoogleClientId()).toBe(
            "test-client-id.apps.googleusercontent.com",
        );
    });

    it("exposes exactly the calendar scope for the browser popup", () => {
        expect(service.getGoogleScopes()).toEqual([
            "https://www.googleapis.com/auth/calendar",
        ]);
    });

    it("reports connectedness from the stored link", async () => {
        links.findOne.mockResolvedValueOnce(null);
        await expect(service.isGoogleCalendarConnected("u1")).resolves.toBe(
            false,
        );

        links.findOne.mockResolvedValueOnce(makeLink());
        await expect(service.isGoogleCalendarConnected("u1")).resolves.toBe(
            true,
        );
    });

    it("drops the link row on disconnect", async () => {
        await service.disconnectGoogleCalendar("u1");
        expect(links.deleteOne).toHaveBeenCalledWith({ userId: "u1" });
    });
});

describe("connectGoogleCalendar", () => {
    it("redeems the popup code against the reserved postmessage redirect_uri", async () => {
        await service.connectGoogleCalendar("u1", "gis-auth-code");

        const client = lastClient();
        expect(client.redirectUri).toBe("postmessage");
        expect(client.clientId).toBe(
            "test-client-id.apps.googleusercontent.com",
        );
        expect(client.getToken).toHaveBeenCalledWith("gis-auth-code");
    });

    it("persists the link with tokens sealed at rest", async () => {
        await service.connectGoogleCalendar("u1", "code");

        const [filter, update, options] = links.updateOne.mock.calls[0];
        expect(filter).toEqual({ userId: "u1" });
        expect(options).toEqual({ upsert: true });

        const $set = update.$set;
        // Sealed format, not the plaintext Google handed over…
        expect($set.accessToken).toMatch(/^v1:/);
        expect($set.accessToken).not.toContain("access-token");
        // …and openable again only through secret-box.
        expect(openSecret($set.accessToken)).toBe("access-token");
        expect(openSecret($set.refreshToken)).toBe("refresh-token");
        expect($set.calendarId).toBe("cal-new");
        expect($set.connectedAt).toEqual(expect.any(Number));
    });

    it("refuses to persist anything when Google omits the refresh token", async () => {
        gapi.nextTokens.refresh_token = undefined;

        await expect(
            service.connectGoogleCalendar("u1", "code"),
        ).rejects.toThrow(/refresh token/i);
        expect(links.updateOne).not.toHaveBeenCalled();
    });

    it("reuses the already-named calendar instead of creating another", async () => {
        gapi.api.calendarList.list.mockResolvedValueOnce({
            data: { items: [{ id: "cal-existing", summary: ITERATION_LABEL }] },
        });

        await service.connectGoogleCalendar("u1", "code");

        expect(gapi.api.calendars.insert).not.toHaveBeenCalled();
        expect(gapi.api.calendars.patch).not.toHaveBeenCalled();
        const { $set } = links.updateOne.mock.calls[0][1];
        expect($set.calendarId).toBe("cal-existing");
    });

    it("adopts the iteration label on a legacy 'Bluz' calendar (#482)", async () => {
        gapi.api.calendarList.list.mockResolvedValueOnce({
            data: { items: [{ id: "cal-legacy", summary: "Bluz" }] },
        });

        await service.connectGoogleCalendar("u1", "code");

        expect(gapi.api.calendars.patch).toHaveBeenCalledWith({
            calendarId: "cal-legacy",
            requestBody: { summary: ITERATION_LABEL },
        });
    });

    it("still completes the connect when the cosmetic rename fails", async () => {
        gapi.api.calendarList.list.mockResolvedValueOnce({
            data: { items: [{ id: "cal-legacy", summary: "Bluz" }] },
        });
        gapi.api.calendars.patch.mockRejectedValueOnce(new Error("409"));

        await expect(
            service.connectGoogleCalendar("u1", "code"),
        ).resolves.toBeUndefined();
        expect(links.updateOne).toHaveBeenCalled();
    });

    it("creates the dedicated calendar when none exists yet", async () => {
        gapi.api.calendarList.list.mockResolvedValueOnce({
            data: { items: [{ id: "other", summary: "תודה לרבי" }] },
        });

        await service.connectGoogleCalendar("u1", "code");

        expect(gapi.api.calendars.insert).toHaveBeenCalledWith({
            requestBody: { summary: ITERATION_LABEL },
        });
        const { $set } = links.updateOne.mock.calls[0][1];
        expect($set.calendarId).toBe("cal-new");
    });

    it("falls back to the legacy name when no iteration is registered", async () => {
        dbIterations.currentOrNull.mockResolvedValueOnce(null);

        await service.connectGoogleCalendar("u1", "code");

        expect(gapi.api.calendars.insert).toHaveBeenCalledWith({
            requestBody: { summary: "Bluz" },
        });
    });

    it("falls back to the legacy name when the registry is unreachable", async () => {
        dbIterations.currentOrNull.mockRejectedValueOnce(new Error("mongo"));

        await service.connectGoogleCalendar("u1", "code");

        expect(gapi.api.calendars.insert).toHaveBeenCalledWith({
            requestBody: { summary: "Bluz" },
        });
    });

    it("fails loudly when Google returns no calendar id", async () => {
        gapi.api.calendars.insert.mockResolvedValueOnce({ data: {} });

        await expect(
            service.connectGoogleCalendar("u1", "code"),
        ).rejects.toThrow(/Failed to create the Bluz Google calendar/);
    });
});

describe("pushEventToGoogle", () => {
    it("mirrors the event under a deterministic id with bluz tagging", async () => {
        await service.pushEventToGoogle("u1", eventFixture(), "upsert");

        expect(gapi.google.calendar).toHaveBeenCalled();
        const [args] = gapi.api.events.update.mock.calls[0];
        // Dashes stripped, lowercased: stable across pushes.
        expect(args.eventId).toBe("abcdef123");
        expect(args.calendarId).toBe("cal-bluz");
        expect(args.requestBody.summary).toBe("שיעור");
        expect(args.requestBody.start.dateTime).toBe(
            "2026-03-02T09:00:00.000Z",
        );
        expect(args.requestBody.end.dateTime).toBe("2026-03-02T10:00:00.000Z");
        // The pull path finds its way home through this tag (#538 item 6).
        expect(args.requestBody.extendedProperties.private.bluzEventId).toBe(
            "abc-def-123",
        );
    });

    it("falls back to the event type when the name is empty", async () => {
        await service.pushEventToGoogle(
            "u1",
            eventFixture({ name: "" }),
            "upsert",
        );

        expect(
            gapi.api.events.update.mock.calls[0][0].requestBody.summary,
        ).toBe(EventType.LECTURE);
    });

    it("updates in place when Google already knows the event", async () => {
        await service.pushEventToGoogle("u1", eventFixture(), "upsert");

        expect(gapi.api.events.update).toHaveBeenCalledTimes(1);
        expect(gapi.api.events.insert).not.toHaveBeenCalled();
    });

    it("inserts instead when the mirrored copy vanished (update 404)", async () => {
        gapi.api.events.update.mockRejectedValueOnce({ code: 404 });

        await service.pushEventToGoogle("u1", eventFixture(), "upsert");

        const updateArgs = gapi.api.events.update.mock.calls[0][0];
        expect(gapi.api.events.insert).toHaveBeenCalledWith({
            calendarId: updateArgs.calendarId,
            requestBody: updateArgs.requestBody,
        });
    });

    it("deletes by the same deterministic id", async () => {
        await service.pushEventToGoogle("u1", eventFixture(), "delete");

        expect(gapi.api.events.delete).toHaveBeenCalledWith({
            calendarId: "cal-bluz",
            eventId: "abcdef123",
        });
        expect(gapi.api.events.update).not.toHaveBeenCalled();
    });

    it("swallows a delete 404 (already gone)", async () => {
        gapi.api.events.delete.mockRejectedValueOnce({ code: 404 });

        await expect(
            service.pushEventToGoogle("u1", eventFixture(), "delete"),
        ).resolves.toBeUndefined();
        expect(console.warn).not.toHaveBeenCalled();
    });

    it("never throws on a Google outage — any action", async () => {
        gapi.api.events.update.mockRejectedValueOnce(new Error("ECONNRESET"));
        await expect(
            service.pushEventToGoogle("u1", eventFixture(), "upsert"),
        ).resolves.toBeUndefined();
        expect(console.warn).toHaveBeenCalledWith(
            expect.stringContaining("push skipped"),
            expect.anything(),
        );

        gapi.api.events.delete.mockRejectedValueOnce(new Error("ECONNRESET"));
        await expect(
            service.pushEventToGoogle("u1", eventFixture(), "delete"),
        ).resolves.toBeUndefined();

        // Even the 404-fallback insert failing stays contained.
        gapi.api.events.update.mockRejectedValueOnce({ code: 404 });
        gapi.api.events.insert.mockRejectedValueOnce(new Error("quota"));
        await expect(
            service.pushEventToGoogle("u1", eventFixture(), "upsert"),
        ).resolves.toBeUndefined();
    });

    it("is a silent no-op when the user never connected", async () => {
        links.findOne.mockResolvedValue(null);

        await service.pushEventToGoogle("u1", eventFixture(), "upsert");

        expect(gapi.google.calendar).not.toHaveBeenCalled();
    });

    it("is a silent no-op when no OAuth client is configured", async () => {
        const unconfigured = await loadUnconfigured();
        const callsBefore = totalApiCalls();
        const clientsBefore = gapi.oauthInstances.length;

        await expect(
            unconfigured.pushEventToGoogle("u1", eventFixture(), "upsert"),
        ).resolves.toBeUndefined();

        expect(totalApiCalls()).toBe(callsBefore);
        expect(gapi.oauthInstances.length).toBe(clientsBefore);
    });

    it("re-seals rotated tokens when Google refreshes them mid-flight", async () => {
        await service.pushEventToGoogle("u1", eventFixture(), "upsert");
        links.updateOne.mockClear();

        lastClient().emitTokens({
            access_token: "rotated-access",
            refresh_token: "rotated-refresh",
            expiry_date: 2_000_000_000_000,
        });
        await flushAsyncWork();

        const $set = links.updateOne.mock.calls[0][1].$set;
        expect(openSecret($set.accessToken)).toBe("rotated-access");
        expect(openSecret($set.refreshToken)).toBe("rotated-refresh");
        expect($set.expiryDate).toBe(2_000_000_000_000);
    });
});

describe("pushAllEvents", () => {
    it("backfills every event and reports the count even when pushes fail", async () => {
        gapi.api.events.update.mockRejectedValue(new Error("offline"));

        const pushed = await service.pushAllEvents("u1", [
            eventFixture(),
            eventFixture({ id: "e2" }),
            eventFixture({ id: "e3" }),
        ]);

        expect(pushed).toBe(3);
        expect(gapi.api.events.update).toHaveBeenCalledTimes(3);
    });
});

describe("pullEventEdits", () => {
    /** A Google-side edit of an event Bluz originally pushed. */
    const editedGoogleEvent = {
        extendedProperties: { private: { bluzEventId: "abc-def-123" } },
        summary: "שם חדש מגוגל",
        description: "הערה חדשה",
        start: { dateTime: "2026-03-02T11:00:00Z" },
        end: { dateTime: "2026-03-02T12:30:00Z" },
    };

    const listResponse = (items: Array<unknown>, extra: object = {}) => ({
        data: { items, ...extra },
    });

    it("returns 0 when the user never connected", async () => {
        links.findOne.mockResolvedValue(null);

        await expect(service.pullEventEdits("u1")).resolves.toBe(0);
        expect(gapi.api.events.list).not.toHaveBeenCalled();
    });

    it("returns 0 when no OAuth client is configured", async () => {
        const unconfigured = await loadUnconfigured();

        await expect(unconfigured.pullEventEdits("u1")).resolves.toBe(0);
    });

    it("applies a Google-side edit onto the tagged Bluz event", async () => {
        dbEvent.get.mockResolvedValue(eventFixture());
        gapi.api.events.list.mockResolvedValueOnce(
            listResponse([editedGoogleEvent], { nextSyncToken: "sync-1" }),
        );

        const updated = await service.pullEventEdits("u1");

        expect(updated).toBe(1);
        expect(dbEvent.get).toHaveBeenCalledWith("abc-def-123");
        const [saved, , , , origin] = dbEvent.set.mock.calls[0];
        expect(saved.name).toBe("שם חדש מגוגל");
        expect(saved.notes).toBe("הערה חדשה");
        expect((saved.startTime as Date).toISOString()).toBe(
            "2026-03-02T11:00:00.000Z",
        );
        expect((saved.endTime as Date).toISOString()).toBe(
            "2026-03-02T12:30:00.000Z",
        );
        // Untouched structured fields ride along unchanged.
        expect(saved.subject).toBe(baseEvent.subject);
        // The history log attributes the change to the sync, not a human.
        expect(origin).toEqual({
            initiator: EventChangeInitiator.GoogleSync,
        });
    });

    it("ignores events Bluz never pushed (no bluzEventId tag)", async () => {
        gapi.api.events.list.mockResolvedValueOnce(
            listResponse([{ summary: "אירוע שנוצר ישירות בגוגל" }]),
        );

        await expect(service.pullEventEdits("u1")).resolves.toBe(0);
        expect(dbEvent.get).not.toHaveBeenCalled();
        expect(dbEvent.set).not.toHaveBeenCalled();
    });

    it("ignores cancellations — deleting the mirror is not deleting in Bluz", async () => {
        gapi.api.events.list.mockResolvedValueOnce(
            listResponse([
                {
                    extendedProperties: {
                        private: { bluzEventId: "abc-def-123" },
                    },
                    status: "cancelled",
                },
            ]),
        );

        await expect(service.pullEventEdits("u1")).resolves.toBe(0);
        expect(dbEvent.get).not.toHaveBeenCalled();
    });

    it("ignores edits that resolve to an archived Bluz event", async () => {
        dbEvent.get.mockResolvedValue(null);
        gapi.api.events.list.mockResolvedValueOnce(
            listResponse([editedGoogleEvent]),
        );

        await expect(service.pullEventEdits("u1")).resolves.toBe(0);
        expect(dbEvent.set).not.toHaveBeenCalled();
    });

    it("treats identical content as a no-op", async () => {
        const untouched = eventFixture({ notes: "" });
        dbEvent.get.mockResolvedValue(untouched);
        gapi.api.events.list.mockResolvedValueOnce(
            listResponse([
                {
                    extendedProperties: {
                        private: { bluzEventId: "abc-def-123" },
                    },
                    summary: untouched.name,
                    start: {
                        dateTime: untouched.startTime.toISOString(),
                    },
                    end: { dateTime: untouched.endTime.toISOString() },
                },
            ]),
        );

        await expect(service.pullEventEdits("u1")).resolves.toBe(0);
        expect(dbEvent.set).not.toHaveBeenCalled();
    });

    it("clears stored notes when Google dropped the description", async () => {
        dbEvent.get.mockResolvedValue(eventFixture({ notes: "הערה ישנה" }));
        gapi.api.events.list.mockResolvedValueOnce(
            listResponse([
                {
                    extendedProperties: {
                        private: { bluzEventId: "abc-def-123" },
                    },
                    summary: "שיעור",
                    start: { dateTime: "2026-03-02T09:00:00Z" },
                    end: { dateTime: "2026-03-02T10:00:00Z" },
                },
            ]),
        );

        await expect(service.pullEventEdits("u1")).resolves.toBe(1);
        expect(dbEvent.set.mock.calls[0][0].notes).toBe("");
    });

    it("persists nextSyncToken for the next incremental pull", async () => {
        gapi.api.events.list.mockResolvedValueOnce(
            listResponse([], { nextSyncToken: "sync-cursor" }),
        );

        await service.pullEventEdits("u1");

        const [filter, update] = links.updateOne.mock.calls[0];
        expect(filter).toEqual({ userId: "u1" });
        expect(update.$set.syncToken).toBe("sync-cursor");
    });

    it("follows pagination until pages run out", async () => {
        dbEvent.get.mockResolvedValue(eventFixture());
        gapi.api.events.list
            .mockResolvedValueOnce(
                listResponse([editedGoogleEvent], { nextPageToken: "p2" }),
            )
            .mockResolvedValueOnce(
                listResponse([], { nextSyncToken: "final-sync" }),
            );

        await expect(service.pullEventEdits("u1")).resolves.toBe(1);

        expect(gapi.api.events.list).toHaveBeenCalledTimes(2);
        expect(gapi.api.events.list.mock.calls[1][0]).toMatchObject({
            pageToken: "p2",
        });
        expect(links.updateOne).toHaveBeenCalledWith(
            { userId: "u1" },
            { $set: { syncToken: "final-sync" } },
            { upsert: true },
        );
    });

    it("full-resyncs when the stored sync token expired (410 GONE)", async () => {
        links.findOne.mockResolvedValue(makeLink({ syncToken: "stale" }));
        dbEvent.get.mockResolvedValue(eventFixture());
        gapi.api.events.list
            .mockRejectedValueOnce({ code: 410 })
            .mockResolvedValueOnce(
                listResponse([editedGoogleEvent], { nextSyncToken: "fresh" }),
            );

        await expect(service.pullEventEdits("u1")).resolves.toBe(1);

        expect(gapi.api.events.list).toHaveBeenCalledTimes(2);
        // First attempt carried the stale cursor…
        expect(gapi.api.events.list.mock.calls[0][0].syncToken).toBe("stale");
        // …the retry after 410 went out without one (full resync).
        expect("syncToken" in gapi.api.events.list.mock.calls[1][0]).toBe(
            false,
        );
        expect(links.updateOne).toHaveBeenCalledWith(
            { userId: "u1" },
            { $set: { syncToken: "fresh" } },
            { upsert: true },
        );
    });

    it("surfaces other errors as 0, never as a rejection", async () => {
        gapi.api.events.list.mockRejectedValueOnce({ code: 500 });

        await expect(service.pullEventEdits("u1")).resolves.toBe(0);
        expect(console.warn).toHaveBeenCalledWith(
            expect.stringContaining("edit pull skipped"),
            expect.anything(),
        );
    });

    it("gives up (returning 0) on a bare 410 with no prior token", async () => {
        gapi.api.events.list.mockRejectedValueOnce({ code: 410 });

        await expect(service.pullEventEdits("u1")).resolves.toBe(0);
        expect(gapi.api.events.list).toHaveBeenCalledTimes(1);
    });

    it("lists incrementally against the user's own Bluz calendar", async () => {
        links.findOne.mockResolvedValue(
            makeLink({ syncToken: "cursor-from-last-time" }),
        );
        gapi.api.events.list.mockResolvedValueOnce(
            listResponse([], { nextSyncToken: "next" }),
        );

        await service.pullEventEdits("u1");

        expect(gapi.api.events.list.mock.calls[0][0]).toMatchObject({
            calendarId: "cal-bluz",
            singleEvents: false,
            showDeleted: true,
            syncToken: "cursor-from-last-time",
        });
    });
});

describe("pullBusyBlocks", () => {
    it("maps the user's primary-calendar busy ranges", async () => {
        gapi.api.freebusy.query.mockResolvedValueOnce({
            data: {
                calendars: {
                    primary: {
                        busy: [
                            {
                                start: "2026-08-23T09:00:00Z",
                                end: "2026-08-23T10:00:00Z",
                            },
                            {
                                start: "2026-08-24T09:00:00Z",
                                end: "2026-08-24T11:00:00Z",
                            },
                        ],
                    },
                },
            },
        });

        await expect(service.pullBusyBlocks("u1")).resolves.toEqual([
            { start: "2026-08-23T09:00:00Z", end: "2026-08-23T10:00:00Z" },
            { start: "2026-08-24T09:00:00Z", end: "2026-08-24T11:00:00Z" },
        ]);

        const query = gapi.api.freebusy.query.mock.calls[0][0];
        expect(query.requestBody.items).toEqual([{ id: "primary" }]);
        expect(new Date(query.requestBody.timeMax).getTime()).toBeGreaterThan(
            new Date(query.requestBody.timeMin).getTime(),
        );
    });

    it("tolerates missing busy entries", async () => {
        gapi.api.freebusy.query.mockResolvedValueOnce({
            data: {
                calendars: {
                    primary: { busy: [{ start: "2026-08-23T09:00:00Z" }] },
                },
            },
        });

        await expect(service.pullBusyBlocks("u1")).resolves.toEqual([
            { start: "2026-08-23T09:00:00Z", end: "" },
        ]);
    });

    it("returns [] when the primary calendar is absent", async () => {
        gapi.api.freebusy.query.mockResolvedValueOnce({ data: {} });

        await expect(service.pullBusyBlocks("u1")).resolves.toEqual([]);
    });

    it("returns [] on failure rather than throwing", async () => {
        gapi.api.freebusy.query.mockRejectedValueOnce(new Error("offline"));

        await expect(service.pullBusyBlocks("u1")).resolves.toEqual([]);
        expect(console.warn).toHaveBeenCalled();
    });

    it("returns [] when disconnected", async () => {
        links.findOne.mockResolvedValue(null);

        await expect(service.pullBusyBlocks("u1")).resolves.toEqual([]);
        expect(gapi.api.freebusy.query).not.toHaveBeenCalled();
    });

    it("returns [] when unconfigured", async () => {
        const unconfigured = await loadUnconfigured();

        await expect(unconfigured.pullBusyBlocks("u1")).resolves.toEqual([]);
    });
});
