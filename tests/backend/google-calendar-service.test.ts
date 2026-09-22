import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { logger } from "@/logging/pino";

/**
 * Unit tests for the Google Calendar integration, with the `googleapis` client
 * and the Mongo controllers fully mocked — nothing here touches the network or
 * a database. The contracts under test are the ones the rest of Bluz relies
 * on: tokens are sealed before persistence, the GIS popup code is redeemed
 * against the reserved "postmessage" redirect_uri, and every push/pull path is
 * a safe no-op (never a rejection) when Google is unreachable.
 */

const { gapi, links, personalSettings, mongo, dbEvent, dbIterations } =
    vi.hoisted(() => {
    /** Every API surface the service reaches for, as one shared fake. */
    const calendarApi = {
        calendarList: {
            list: vi.fn(async () => ({ data: { items: [] } })),
            get: vi.fn(async () => ({ data: {} })),
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

    type FakeOAuth2Options = {
        clientId?: string;
        clientSecret?: string;
        endpoints?: Record<string, string>;
        redirectUri?: string;
    };

    class FakeOAuth2 {
        public clientId?: string;
        public clientSecret?: string;
        public redirectUri?: string;
        /** Only the options form carries these; see the service's stub override. */
        public endpoints?: Record<string, string>;
        public credentials: Record<string, unknown> = {};
        public tokenHandlers: Array<(tokens: Record<string, unknown>) => void> =
            [];
        public getToken = vi.fn(async () => ({ tokens: state.nextTokens }));

        // google-auth-library accepts either three positional arguments or a
        // single options object; the service uses the latter, since `endpoints`
        // is read-only once constructed.
        constructor(
            clientIdOrOptions?: FakeOAuth2Options | string,
            clientSecret?: string,
            redirectUri?: string,
        ) {
            if (typeof clientIdOrOptions === "object" && clientIdOrOptions) {
                this.clientId = clientIdOrOptions.clientId;
                this.clientSecret = clientIdOrOptions.clientSecret;
                this.redirectUri = clientIdOrOptions.redirectUri;
                this.endpoints = clientIdOrOptions.endpoints;
            } else {
                this.clientId = clientIdOrOptions;
                this.clientSecret = clientSecret;
                this.redirectUri = redirectUri;
            }
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
            find: vi.fn(() => ({ toArray: async () => [] })),
            countDocuments: vi.fn(async () => 1),
        },
        personalSettings: {
            find: vi.fn(() => ({ toArray: async () => [] })),
        },
        mongo: {
            resolveIterationDb: vi.fn(async (id?: string) => ({
                dbName: id ? `db-${id}` : "db-current",
            })),
            getDatabaseController: vi.fn((dbName: string) => ({ dbName })),
        },
        dbEvent: {
            get: vi.fn(),
            getMultiple: vi.fn(async () => []),
            set: vi.fn(async () => undefined),
        },
        dbIterations: {
            currentOrNull: vi.fn(),
            get: vi.fn(async () => null),
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
        googleCalendarLinks: links,
        personalSettings,
    })),
    resolveIterationDb: mongo.resolveIterationDb,
    getDatabaseController: mongo.getDatabaseController,
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
    // Backoff is exercised explicitly below; everywhere else it must not
    // slow the suite down or turn a one-off rejection into a silent retry.
    service.googleRetryPolicy.attempts = 1;
    service.googleRetryPolicy.baseDelayMs = 0;
    service.googleRetryPolicy.maxDelayMs = 0;
    links.find.mockReturnValue({ toArray: async () => [] });
    links.countDocuments.mockResolvedValue(1);
    personalSettings.find.mockReturnValue({ toArray: async () => [] });
    dbEvent.getMultiple.mockResolvedValue([]);
    dbIterations.get.mockResolvedValue(null);
    gapi.api.calendarList.get.mockResolvedValue({ data: {} });
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

/** Loads a fresh copy pointed at the e2e stub's token endpoint. */
async function loadWithStubTokenUrl(tokenUrl: string) {
    process.env.GOOGLE_OAUTH_TOKEN_URL = tokenUrl;
    try {
        vi.resetModules();
        return await import("@/api-server/google/google-calendar-service");
    } finally {
        delete process.env.GOOGLE_OAUTH_TOKEN_URL;
    }
}

describe("configuration surface", () => {
    // The override has to reach the constructor: `endpoints` is read-only on a
    // built client, so setting it afterwards left every token exchange going to
    // the real oauth2.googleapis.com and e2e failed with `invalid_client`.
    it("sends the token exchange to GOOGLE_OAUTH_TOKEN_URL when it is set", async () => {
        const stubbed = await loadWithStubTokenUrl(
            "http://google-stub:8080/token",
        );
        gapi.oauthInstances.length = 0;

        await stubbed.connectGoogleCalendar("u1", "code");

        expect(lastClient().endpoints).toEqual({
            oauth2TokenUrl: "http://google-stub:8080/token",
        });
        vi.resetModules();
    });

    it("leaves the endpoints alone when no override is configured", async () => {
        gapi.oauthInstances.length = 0;

        await service.connectGoogleCalendar("u1", "code");

        expect(lastClient().endpoints).toBeUndefined();
    });

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
        // api-server logs through pino now, not console (#538 item 13).
        const warn = vi.spyOn(logger, "warn").mockImplementation(() => logger);

        await expect(
            service.pushEventToGoogle("u1", eventFixture(), "delete"),
        ).resolves.toBe(true);
        expect(warn).not.toHaveBeenCalled();
    });

    it("never throws on a Google outage — any action", async () => {
        const warn = vi.spyOn(logger, "warn").mockImplementation(() => logger);

        gapi.api.events.update.mockRejectedValueOnce(new Error("ECONNRESET"));
        await expect(
            service.pushEventToGoogle("u1", eventFixture(), "upsert"),
        ).resolves.toBe(false);
        expect(warn).toHaveBeenCalledWith(
            expect.objectContaining({ err: expect.anything() }),
            expect.stringContaining("push skipped"),
        );

        gapi.api.events.delete.mockRejectedValueOnce(new Error("ECONNRESET"));
        await expect(
            service.pushEventToGoogle("u1", eventFixture(), "delete"),
        ).resolves.toBe(false);

        // Even the 404-fallback insert failing stays contained.
        gapi.api.events.update.mockRejectedValueOnce({ code: 404 });
        gapi.api.events.insert.mockRejectedValueOnce(new Error("quota"));
        await expect(
            service.pushEventToGoogle("u1", eventFixture(), "upsert"),
        ).resolves.toBe(false);
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
        ).resolves.toBe(false);

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
    it("attempts every event but counts only what reached Google", async () => {
        // Counting attempts reported a full successful sync even when every
        // push was silently swallowed (#538 item 6).
        gapi.api.events.update.mockRejectedValue(new Error("offline"));

        const pushed = await service.pushAllEvents("u1", [
            eventFixture(),
            eventFixture({ id: "e2" }),
            eventFixture({ id: "e3" }),
        ]);

        expect(pushed).toBe(0);
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
        // get(id, iterationId, controller) — the sync passes the last two through.
        expect(dbEvent.get).toHaveBeenCalledWith(
            "abc-def-123",
            undefined,
            undefined,
        );
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
        const warn = vi.spyOn(logger, "warn").mockImplementation(() => logger);

        await expect(service.pullEventEdits("u1")).resolves.toBe(0);
        expect(warn).toHaveBeenCalledWith(
            expect.objectContaining({ err: expect.anything() }),
            expect.stringContaining("edit pull skipped"),
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
        const warn = vi.spyOn(logger, "warn").mockImplementation(() => logger);

        await expect(service.pullBusyBlocks("u1")).resolves.toEqual([]);
        expect(warn).toHaveBeenCalled();
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

// ---------------------------------------------------------------------------
// Google API conduct: backoff + idempotent ids
// ---------------------------------------------------------------------------

describe("withBackoff / retry classification", () => {
    beforeEach(() => {
        service.googleRetryPolicy.attempts = 3;
        service.googleRetryPolicy.baseDelayMs = 0;
        service.googleRetryPolicy.maxDelayMs = 0;
    });

    it("classifies per Google's error guide", () => {
        expect(service.isRetryableGoogleError({ code: 429 })).toBe(true);
        expect(service.isRetryableGoogleError({ code: 500 })).toBe(true);
        expect(service.isRetryableGoogleError({ response: { status: 503 } })).toBe(true);
        expect(
            service.isRetryableGoogleError({
                code: 403,
                errors: [{ reason: "rateLimitExceeded" }],
            }),
        ).toBe(true);
        expect(
            service.isRetryableGoogleError({
                code: 403,
                errors: [{ reason: "userRateLimitExceeded" }],
            }),
        ).toBe(true);
        // A plain forbidden, a bad request, a 404, a 409 and a 410 are the
        // caller's problem, not something a retry fixes.
        expect(
            service.isRetryableGoogleError({ code: 403, errors: [{ reason: "forbidden" }] }),
        ).toBe(false);
        expect(service.isRetryableGoogleError({ code: 400 })).toBe(false);
        expect(service.isRetryableGoogleError({ code: 404 })).toBe(false);
        expect(service.isRetryableGoogleError({ code: 409 })).toBe(false);
        expect(service.isRetryableGoogleError({ code: 410 })).toBe(false);
        expect(service.isRetryableGoogleError(new Error("ECONNRESET"))).toBe(false);
    });

    it("reads a string status code the way gaxios sometimes reports it", () => {
        expect(service.googleErrorStatus({ code: "429" })).toBe(429);
        expect(service.googleErrorStatus({ code: "ENOTFOUND" })).toBeUndefined();
    });

    it("retries a rate limit until it clears, within the attempt budget", async () => {
        const call = vi
            .fn()
            .mockRejectedValueOnce({ code: 429 })
            .mockRejectedValueOnce({ code: 503 })
            .mockResolvedValueOnce("ok");

        await expect(service.withBackoff(call)).resolves.toBe("ok");
        expect(call).toHaveBeenCalledTimes(3);
    });

    it("gives up after the last attempt with the final error", async () => {
        const call = vi.fn().mockRejectedValue({ code: 500 });

        await expect(service.withBackoff(call)).rejects.toEqual({ code: 500 });
        expect(call).toHaveBeenCalledTimes(3);
    });

    it("does not retry a client error at all", async () => {
        const call = vi.fn().mockRejectedValue({ code: 404 });

        await expect(service.withBackoff(call)).rejects.toEqual({ code: 404 });
        expect(call).toHaveBeenCalledTimes(1);
    });

    it("pushes through a transient 503 on the update", async () => {
        gapi.api.events.update
            .mockRejectedValueOnce({ code: 503 })
            .mockResolvedValueOnce({ data: {} });

        await expect(
            service.pushEventToGoogle("u1", eventFixture(), "upsert"),
        ).resolves.toBe(true);
        expect(gapi.api.events.update).toHaveBeenCalledTimes(2);
    });
});

describe("pushEventToGoogle — id conduct", () => {
    it("derives a base32hex-safe id from the Bluz id", () => {
        expect(service.toGoogleEventId("A1B2-C3D4-e5f6")).toBe("a1b2c3d4e5f6");
        expect(service.toGoogleEventId("a1b2c3d4e5f6")).toMatch(/^[a-v0-9]{5,1024}$/);
    });

    it("marks the copy confirmed and bluz-managed", async () => {
        await service.pushEventToGoogle("u1", eventFixture(), "upsert", "2026a");

        const [args] = gapi.api.events.update.mock.calls[0];
        expect(args.requestBody.status).toBe("confirmed");
        expect(args.requestBody.extendedProperties.private).toEqual({
            bluzManaged: "true",
            bluzEventId: "abc-def-123",
            bluzIterationId: "2026a",
        });
    });

    it("recovers from a 409 on insert by updating the existing holder of the id", async () => {
        // First update: nothing there. Insert: the id is held (a tombstone or
        // a concurrent push). Second update: lands.
        gapi.api.events.update
            .mockRejectedValueOnce({ code: 404 })
            .mockResolvedValueOnce({ data: {} });
        gapi.api.events.insert.mockRejectedValueOnce({ code: 409 });

        await expect(
            service.pushEventToGoogle("u1", eventFixture(), "upsert"),
        ).resolves.toBe(true);
        expect(gapi.api.events.insert).toHaveBeenCalledTimes(1);
        expect(gapi.api.events.update).toHaveBeenCalledTimes(2);
    });

    it("surfaces a non-409 insert failure as a skipped push", async () => {
        gapi.api.events.update.mockRejectedValueOnce({ code: 404 });
        gapi.api.events.insert.mockRejectedValueOnce({
            code: 403,
            errors: [{ reason: "forbidden" }],
        });

        await expect(
            service.pushEventToGoogle("u1", eventFixture(), "upsert"),
        ).resolves.toBe(false);
    });

    it("treats a 410 on delete as already gone", async () => {
        gapi.api.events.delete.mockRejectedValueOnce({ code: 410 });

        await expect(
            service.pushEventToGoogle("u1", eventFixture(), "delete"),
        ).resolves.toBe(true);
    });
});

// ---------------------------------------------------------------------------
// Shared calendars + iteration binding
// ---------------------------------------------------------------------------

describe("connectGoogleCalendar — shared calendars and iteration binding", () => {
    beforeEach(() => {
        dbIterations.currentOrNull.mockResolvedValue({
            id: "2026a",
            label: ITERATION_LABEL,
        });
    });

    it("asks Google for writable calendars only", async () => {
        await service.connectGoogleCalendar("u1", "code");

        expect(gapi.api.calendarList.list).toHaveBeenCalledWith(
            expect.objectContaining({ minAccessRole: "writer" }),
        );
    });

    it("joins a colleague's shared calendar already named after the iteration", async () => {
        gapi.api.calendarList.list.mockResolvedValueOnce({
            data: {
                items: [
                    { id: "shared-1", summary: ITERATION_LABEL, accessRole: "writer" },
                ],
            },
        });

        await service.connectGoogleCalendar("u1", "code");

        const [, update] = links.updateOne.mock.calls[0];
        expect(update.$set).toMatchObject({
            calendarId: "shared-1",
            calendarSummary: ITERATION_LABEL,
            calendarAccessRole: "writer",
            iterationId: "2026a",
        });
        expect(gapi.api.calendars.insert).not.toHaveBeenCalled();
    });

    it("prefers the user's own calendar over a shared one of the same name", async () => {
        gapi.api.calendarList.list.mockResolvedValueOnce({
            data: {
                items: [
                    { id: "shared-1", summary: ITERATION_LABEL, accessRole: "writer" },
                    { id: "own-1", summary: ITERATION_LABEL, accessRole: "owner" },
                ],
            },
        });

        await service.connectGoogleCalendar("u1", "code");

        expect(links.updateOne.mock.calls[0][1].$set.calendarId).toBe("own-1");
    });

    it("never renames a shared calendar it does not own", async () => {
        gapi.api.calendarList.list.mockResolvedValueOnce({
            data: {
                items: [{ id: "shared-legacy", summary: "Bluz", accessRole: "writer" }],
            },
        });

        await service.connectGoogleCalendar("u1", "code");

        expect(gapi.api.calendars.patch).not.toHaveBeenCalled();
        expect(links.updateOne.mock.calls[0][1].$set.calendarSummary).toBe("Bluz");
    });

    it("skips read-only calendars even if they carry the iteration's name", async () => {
        gapi.api.calendarList.list.mockResolvedValueOnce({
            data: {
                items: [{ id: "ro", summary: ITERATION_LABEL, accessRole: "reader" }],
            },
        });

        await service.connectGoogleCalendar("u1", "code");

        expect(gapi.api.calendars.insert).toHaveBeenCalled();
        expect(links.updateOne.mock.calls[0][1].$set.calendarId).toBe("cal-new");
    });

    it("binds the link to the current iteration and drops any stale cursor", async () => {
        await service.connectGoogleCalendar("u1", "code");

        const [, update] = links.updateOne.mock.calls[0];
        expect(update.$set.iterationId).toBe("2026a");
        expect(update.$unset).toEqual({ syncToken: "" });
    });

    it("stores no iteration when none is registered", async () => {
        dbIterations.currentOrNull.mockResolvedValue(null);

        await service.connectGoogleCalendar("u1", "code");

        expect(links.updateOne.mock.calls[0][1].$set).not.toHaveProperty(
            "iterationId",
        );
    });
});

describe("listGoogleCalendarOptions", () => {
    it("throws a client error when not connected", async () => {
        links.findOne.mockResolvedValue(null);

        await expect(service.listGoogleCalendarOptions("u1")).rejects.toThrow(
            /Google/,
        );
    });

    it("returns writable calendars with shared/primary flags and the current pick", async () => {
        gapi.api.calendarList.list.mockResolvedValueOnce({
            data: {
                items: [
                    { id: "primary-id", summary: "me@x", accessRole: "owner", primary: true },
                    { id: "shared-1", summary: "צוות", accessRole: "writer" },
                    { id: "ro", summary: "חגים", accessRole: "reader" },
                ],
            },
        });

        const result = await service.listGoogleCalendarOptions("u1");

        expect(result.selectedId).toBe("cal-bluz");
        expect(result.calendars).toEqual([
            {
                id: "primary-id",
                summary: "me@x",
                accessRole: "owner",
                primary: true,
                shared: false,
            },
            {
                id: "shared-1",
                summary: "צוות",
                accessRole: "writer",
                primary: false,
                shared: true,
            },
        ]);
    });

    it("follows calendarList pagination", async () => {
        gapi.api.calendarList.list
            .mockResolvedValueOnce({
                data: { items: [{ id: "a", summary: "A" }], nextPageToken: "p2" },
            })
            .mockResolvedValueOnce({ data: { items: [{ id: "b", summary: "B" }] } });

        const result = await service.listGoogleCalendarOptions("u1");

        expect(result.calendars.map((c) => c.id)).toEqual(["a", "b"]);
        expect(gapi.api.calendarList.list).toHaveBeenLastCalledWith(
            expect.objectContaining({ pageToken: "p2" }),
        );
    });

    it("honours a summaryOverride the user gave a shared calendar", async () => {
        gapi.api.calendarList.list.mockResolvedValueOnce({
            data: {
                items: [
                    {
                        id: "s",
                        summary: "Original",
                        summaryOverride: "השם שלי",
                        accessRole: "writer",
                    },
                ],
            },
        });

        const result = await service.listGoogleCalendarOptions("u1");

        expect(result.calendars[0].summary).toBe("השם שלי");
    });
});

describe("selectGoogleCalendar", () => {
    beforeEach(() => {
        dbIterations.currentOrNull.mockResolvedValue({
            id: "2026a",
            label: ITERATION_LABEL,
        });
        dbIterations.get.mockResolvedValue({ id: "2026a", label: ITERATION_LABEL });
        links.countDocuments.mockResolvedValue(3);
    });

    it("re-points the link at a writable existing calendar and resets the cursor", async () => {
        gapi.api.calendarList.get.mockResolvedValueOnce({
            data: { id: "shared-1", summary: "צוות", accessRole: "writer" },
        });

        const selection = await service.selectGoogleCalendar("u1", {
            calendarId: "shared-1",
        });

        expect(gapi.api.calendarList.get).toHaveBeenCalledWith({
            calendarId: "shared-1",
        });
        expect(links.updateOne).toHaveBeenCalledWith(
            { userId: "u1" },
            {
                $set: {
                    calendarId: "shared-1",
                    calendarSummary: "צוות",
                    calendarAccessRole: "writer",
                    iterationId: "2026a",
                },
                $unset: { syncToken: "" },
            },
            { upsert: true },
        );
        expect(selection).toEqual({
            id: "shared-1",
            summary: "צוות",
            accessRole: "writer",
            iterationId: "2026a",
            iterationLabel: ITERATION_LABEL,
            linkedUsers: 3,
        });
    });

    it("rejects a calendar the user cannot write to", async () => {
        gapi.api.calendarList.get.mockResolvedValueOnce({
            data: { id: "ro", summary: "חגים", accessRole: "reader" },
        });

        await expect(
            service.selectGoogleCalendar("u1", { calendarId: "ro" }),
        ).rejects.toThrow(/הרשאת כתיבה/);
        expect(links.updateOne).not.toHaveBeenCalled();
    });

    it("rejects a calendar Google does not know (404)", async () => {
        gapi.api.calendarList.get.mockRejectedValueOnce({ code: 404 });

        await expect(
            service.selectGoogleCalendar("u1", { calendarId: "nope" }),
        ).rejects.toThrow(/הרשאת כתיבה/);
    });

    it("rejects an empty calendar id", async () => {
        await expect(
            service.selectGoogleCalendar("u1", { calendarId: "  " }),
        ).rejects.toThrow(/calendarId/);
    });

    it("creates a fresh calendar named after the current iteration on createNew", async () => {
        const selection = await service.selectGoogleCalendar("u1", {
            createNew: true,
        });

        expect(gapi.api.calendars.insert).toHaveBeenCalledWith({
            requestBody: { summary: ITERATION_LABEL },
        });
        expect(selection.id).toBe("cal-new");
        expect(selection.accessRole).toBe("owner");
    });

    it("throws when not connected", async () => {
        links.findOne.mockResolvedValue(null);

        await expect(
            service.selectGoogleCalendar("u1", { createNew: true }),
        ).rejects.toThrow(/Google/);
    });
});

describe("getGoogleCalendarSelection", () => {
    it("is null while disconnected", async () => {
        links.findOne.mockResolvedValue(null);

        await expect(service.getGoogleCalendarSelection("u1")).resolves.toBeNull();
    });

    it("describes the linked calendar, its iteration and how many users share it", async () => {
        links.findOne.mockResolvedValue(
            makeLink({
                calendarSummary: "צוות",
                calendarAccessRole: "writer",
                iterationId: "2026a",
            }),
        );
        dbIterations.get.mockResolvedValue({ id: "2026a", label: ITERATION_LABEL });
        links.countDocuments.mockResolvedValue(4);

        await expect(service.getGoogleCalendarSelection("u1")).resolves.toEqual({
            id: "cal-bluz",
            summary: "צוות",
            accessRole: "writer",
            iterationId: "2026a",
            iterationLabel: ITERATION_LABEL,
            linkedUsers: 4,
        });
        expect(links.countDocuments).toHaveBeenCalledWith({ calendarId: "cal-bluz" });
    });

    it("falls back to the legacy name and no iteration on a pre-upgrade link", async () => {
        const selection = await service.getGoogleCalendarSelection("u1");

        expect(selection).toMatchObject({ summary: "Bluz", iterationId: undefined });
        expect(dbIterations.get).not.toHaveBeenCalled();
    });
});

describe("pullEventEdits — iteration resolution", () => {
    const copy = (privateProps: Record<string, string>) => ({
        extendedProperties: { private: privateProps },
        summary: "חדש",
    });

    it("resolves an untagged copy against the link's bound iteration", async () => {
        links.findOne.mockResolvedValue(makeLink({ iterationId: "2025b" }));
        dbEvent.get.mockResolvedValue(eventFixture());
        gapi.api.events.list.mockResolvedValueOnce({
            data: { items: [copy({ bluzEventId: "abc-def-123" })] },
        });

        await service.pullEventEdits("u1");

        expect(mongo.resolveIterationDb).toHaveBeenCalledWith("2025b");
        expect(dbEvent.get).toHaveBeenCalledWith("abc-def-123", undefined, {
            dbName: "db-2025b",
        });
    });

    it("lets the copy's own iteration tag win over the link's", async () => {
        links.findOne.mockResolvedValue(makeLink({ iterationId: "2025b" }));
        dbEvent.get.mockResolvedValue(eventFixture());
        gapi.api.events.list.mockResolvedValueOnce({
            data: {
                items: [
                    copy({ bluzEventId: "abc-def-123", bluzIterationId: "2026a" }),
                ],
            },
        });

        await service.pullEventEdits("u1");

        expect(mongo.resolveIterationDb).toHaveBeenCalledWith("2026a");
    });

    it("requests the largest page size the API allows", async () => {
        await service.pullEventEdits("u1");

        expect(gapi.api.events.list).toHaveBeenCalledWith(
            expect.objectContaining({ maxResults: 2500, showDeleted: true }),
        );
    });
});

// ---------------------------------------------------------------------------
// Purge
// ---------------------------------------------------------------------------

describe("purgeGoogleEvents", () => {
    const managed = (id: string, bluzEventId: string, iteration?: string) => ({
        id,
        status: "confirmed",
        extendedProperties: {
            private: {
                bluzEventId,
                ...(iteration ? { bluzIterationId: iteration } : {}),
            },
        },
    });
    const handMade = { id: "hand", summary: "רופא שיניים" };

    beforeEach(() => {
        links.findOne.mockResolvedValue(makeLink({ iterationId: "2026a" }));
        links.find.mockReturnValue({
            toArray: async () => [{ userId: "u1", calendarId: "cal-bluz" }],
        });
        personalSettings.find.mockReturnValue({
            toArray: async () => [
                {
                    userId: "u1",
                    googleCalendarEnabled: true,
                    googleCalendarSyncAllEvents: false,
                },
            ],
        });
    });

    it("throws when not connected", async () => {
        links.findOne.mockResolvedValue(null);

        await expect(service.purgeGoogleEvents("u1", "all")).rejects.toThrow(
            /Google/,
        );
    });

    it("scope=all removes every Bluz-tagged copy and nothing hand-made", async () => {
        gapi.api.events.list.mockResolvedValueOnce({
            data: { items: [managed("g1", "e1"), handMade, managed("g2", "e2")] },
        });

        const result = await service.purgeGoogleEvents("u1", "all");

        expect(result).toEqual({ scanned: 2, removed: 2, failed: 0 });
        expect(
            gapi.api.events.delete.mock.calls.map(([a]) => a.eventId),
        ).toEqual(["g1", "g2"]);
        expect(gapi.api.events.list).toHaveBeenCalledWith(
            expect.objectContaining({ showDeleted: false, maxResults: 2500 }),
        );
    });

    it("scope=orphaned keeps copies backed by a live, in-scope event", async () => {
        gapi.api.events.list.mockResolvedValueOnce({
            data: {
                items: [
                    managed("g-live", "e-live", "2026a"),
                    managed("g-gone", "e-gone", "2026a"),
                ],
            },
        });
        // e-live still exists and user 1 is assigned; e-gone was deleted in Bluz.
        dbEvent.getMultiple.mockResolvedValue([
            eventFixture({ id: "e-live", instructors: [1] }),
        ]);
        personalSettings.find.mockReturnValue({
            toArray: async () => [
                {
                    userId: "1",
                    googleCalendarEnabled: true,
                    googleCalendarSyncAllEvents: false,
                },
            ],
        });

        const result = await service.purgeGoogleEvents("u1", "orphaned");

        expect(result).toEqual({ scanned: 2, removed: 1, failed: 0 });
        expect(gapi.api.events.delete).toHaveBeenCalledTimes(1);
        expect(gapi.api.events.delete.mock.calls[0][0].eventId).toBe("g-gone");
        // Looked the ids up in the calendar's iteration, in one batch.
        expect(mongo.resolveIterationDb).toHaveBeenCalledWith("2026a");
        expect(dbEvent.getMultiple).toHaveBeenCalledWith(
            ["e-live", "e-gone"],
            undefined,
            { dbName: "db-2026a" },
        );
    });

    it("scope=orphaned treats a copy from another iteration as an orphan without a lookup", async () => {
        gapi.api.events.list.mockResolvedValueOnce({
            data: { items: [managed("g-old", "e-old", "2025b")] },
        });

        const result = await service.purgeGoogleEvents("u1", "orphaned");

        expect(result.removed).toBe(1);
        expect(dbEvent.getMultiple).not.toHaveBeenCalled();
    });

    it("scope=orphaned removes a copy no linked user wants any more", async () => {
        gapi.api.events.list.mockResolvedValueOnce({
            data: { items: [managed("g-x", "e-x", "2026a")] },
        });
        // The event lives, but its instructor is user 7 and only user 1 (not
        // sync-all) mirrors into this calendar.
        dbEvent.getMultiple.mockResolvedValue([
            eventFixture({ id: "e-x", instructors: [7] }),
        ]);
        personalSettings.find.mockReturnValue({
            toArray: async () => [
                {
                    userId: "1",
                    googleCalendarEnabled: true,
                    googleCalendarSyncAllEvents: false,
                },
            ],
        });

        const result = await service.purgeGoogleEvents("u1", "orphaned");

        expect(result.removed).toBe(1);
    });

    it("scope=orphaned keeps everything for a sync-all subscriber of the calendar", async () => {
        gapi.api.events.list.mockResolvedValueOnce({
            data: { items: [managed("g-x", "e-x", "2026a")] },
        });
        dbEvent.getMultiple.mockResolvedValue([
            eventFixture({ id: "e-x", instructors: [7] }),
        ]);
        personalSettings.find.mockReturnValue({
            toArray: async () => [
                {
                    userId: "1",
                    googleCalendarEnabled: true,
                    googleCalendarSyncAllEvents: true,
                },
            ],
        });

        const result = await service.purgeGoogleEvents("u1", "orphaned");

        expect(result).toEqual({ scanned: 1, removed: 0, failed: 0 });
        expect(gapi.api.events.delete).not.toHaveBeenCalled();
    });

    it("resolves untagged legacy copies against the link's iteration", async () => {
        gapi.api.events.list.mockResolvedValueOnce({
            data: { items: [managed("g-legacy", "e-legacy")] },
        });

        await service.purgeGoogleEvents("u1", "orphaned");

        expect(mongo.resolveIterationDb).toHaveBeenCalledWith("2026a");
    });

    it("follows pagination across the whole calendar", async () => {
        gapi.api.events.list
            .mockResolvedValueOnce({
                data: { items: [managed("g1", "e1")], nextPageToken: "p2" },
            })
            .mockResolvedValueOnce({ data: { items: [managed("g2", "e2")] } });

        const result = await service.purgeGoogleEvents("u1", "all");

        expect(result.scanned).toBe(2);
        expect(gapi.api.events.list).toHaveBeenLastCalledWith(
            expect.objectContaining({ pageToken: "p2" }),
        );
    });

    it("counts a delete Google refuses, and keeps going", async () => {
        gapi.api.events.list.mockResolvedValueOnce({
            data: {
                items: [managed("g1", "e1"), managed("g2", "e2"), managed("g3", "e3")],
            },
        });
        gapi.api.events.delete
            .mockResolvedValueOnce({ data: {} })
            .mockRejectedValueOnce({ code: 403, errors: [{ reason: "forbidden" }] })
            .mockRejectedValueOnce({ code: 404 });

        const result = await service.purgeGoogleEvents("u1", "all");

        // 404 = already gone = removed; the forbidden one is the failure.
        expect(result).toEqual({ scanned: 3, removed: 2, failed: 1 });
    });
});
