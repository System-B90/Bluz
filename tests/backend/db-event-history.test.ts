import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Unit tests for the event change-log store: what a row records, when a row is
 * skipped, how the actor is resolved, and the guarantee that a logging failure
 * never propagates into the write it documents.
 */

// Hoisted so the `vi.mock` factory below (which runs before module init) can
// close over the same objects the tests assert on.
const { fakeController, fakeHistory } = vi.hoisted(() => {
    const history = {
        find: vi.fn(() => ({
            sort: vi.fn(() => ({ toArray: async () => [] })),
            toArray: async () => [],
        })),
        insertMany: vi.fn(async () => ({ insertedCount: 0 })),
        insertOne: vi.fn(async () => ({ insertedId: "x" })),
    };
    return {
        fakeController: { dbName: "bluz_test", eventHistory: history },
        fakeHistory: history,
    };
});

vi.mock("@/api-server/mongo-db-controller", () => ({
    databaseController: fakeController,
    getDatabaseController: vi.fn(() => fakeController),
}));
vi.mock("@/api-server/session-user", () => ({
    getSessionUser: vi.fn(async () => ({
        displayName: "מיכאל",
        id: "u1",
    })),
}));

import { DbEventHistory } from "@/api-server/db-event-history";
import { getSessionUser } from "@/api-server/session-user";
import { DbEventDocument, EventType } from "@/api-shared/types/event";
import {
    EventChangeAction,
    EventChangeInitiator,
    EventHistoryEntry,
} from "@/api-shared/types/event-history";

function makeDocument(overrides: Partial<DbEventDocument> = {}): DbEventDocument {
    return {
        courses: [],
        endTime: new Date("2024-01-07T09:00:00.000Z"),
        hidden: false,
        hiveLesson: null,
        hiveModule: 0,
        id: "e1",
        instructors: [],
        lecturers: [],
        locked: false,
        name: "שיעור",
        notes: "",
        personalTalk: false,
        required: false,
        rooms: [],
        splitAcrossBreaks: false,
        startTime: new Date("2024-01-07T08:00:00.000Z"),
        subject: 0,
        tags: [],
        type: EventType.LECTURE,
        ...overrides,
    } as DbEventDocument;
}

function insertedRow(): EventHistoryEntry {
    expect(fakeHistory.insertOne).toHaveBeenCalledTimes(1);
    return fakeHistory.insertOne.mock.calls[0][0] as EventHistoryEntry;
}

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSessionUser).mockResolvedValue({
        displayName: "מיכאל",
        id: "u1",
    });
});

describe("DbEventHistory.add", () => {
    it("records a creation with an empty change set", async () => {
        await DbEventHistory.add({
            action: EventChangeAction.Created,
            after: makeDocument(),
            controller: fakeController as never,
            eventId: "e1",
            origin: { initiator: EventChangeInitiator.EventDialog },
        });

        expect(insertedRow()).toMatchObject({
            action: EventChangeAction.Created,
            changes: [],
            eventId: "e1",
            initiator: EventChangeInitiator.EventDialog,
        });
    });

    it("records an update carrying only the fields that changed", async () => {
        await DbEventHistory.add({
            action: EventChangeAction.Updated,
            after: makeDocument({ name: "אחר" }),
            before: makeDocument(),
            controller: fakeController as never,
            eventId: "e1",
            origin: { initiator: EventChangeInitiator.Resize },
        });

        const row = insertedRow();
        expect(row.action).toBe(EventChangeAction.Updated);
        expect(row.changes).toEqual([
            { field: "name", from: "שיעור", to: "אחר" },
        ]);
    });

    it("skips a no-op save entirely", async () => {
        await DbEventHistory.add({
            action: EventChangeAction.Updated,
            after: makeDocument(),
            before: makeDocument(),
            controller: fakeController as never,
            eventId: "e1",
            origin: { initiator: EventChangeInitiator.EventDialog },
        });

        expect(fakeHistory.insertOne).not.toHaveBeenCalled();
    });

    it("records an archival with no before/after needed", async () => {
        await DbEventHistory.add({
            action: EventChangeAction.Archived,
            controller: fakeController as never,
            eventId: "e1",
            origin: { initiator: EventChangeInitiator.Keyboard },
        });

        expect(insertedRow()).toMatchObject({
            action: EventChangeAction.Archived,
            changes: [],
            initiator: EventChangeInitiator.Keyboard,
        });
    });

    it("stores the Hive id in both string and numeric form", async () => {
        vi.mocked(getSessionUser).mockResolvedValue({
            displayName: "מיכאל",
            id: "4271",
        });

        await DbEventHistory.add({
            action: EventChangeAction.Created,
            after: makeDocument(),
            controller: fakeController as never,
            eventId: "e1",
            origin: { initiator: EventChangeInitiator.EventDialog },
        });

        expect(insertedRow()).toMatchObject({
            actorHiveId: 4271,
            actorId: "4271",
        });
    });

    it("leaves the numeric Hive id null for a non-numeric or absent actor", async () => {
        vi.mocked(getSessionUser).mockResolvedValue(null);

        await DbEventHistory.add({
            action: EventChangeAction.Created,
            after: makeDocument(),
            controller: fakeController as never,
            eventId: "e1",
            origin: { initiator: EventChangeInitiator.EventDialog },
        });

        expect(insertedRow()).toMatchObject({
            actorHiveId: null,
            actorId: null,
        });
    });

    it("stamps the acting user from the session, not from the caller", async () => {
        await DbEventHistory.add({
            action: EventChangeAction.Created,
            after: makeDocument(),
            controller: fakeController as never,
            eventId: "e1",
            origin: { initiator: EventChangeInitiator.EventDialog },
        });

        expect(insertedRow()).toMatchObject({
            actorId: "u1",
            actorName: "מיכאל",
        });
    });

    it("records a machine write with a null actor when there is no session", async () => {
        vi.mocked(getSessionUser).mockRejectedValue(new Error("no request scope"));

        await DbEventHistory.add({
            action: EventChangeAction.Created,
            after: makeDocument(),
            controller: fakeController as never,
            eventId: "e1",
            origin: { initiator: EventChangeInitiator.PrayerSettings },
        });

        expect(insertedRow()).toMatchObject({ actorId: null, actorName: null });
    });

    it("keeps the provenance context on the row", async () => {
        await DbEventHistory.add({
            action: EventChangeAction.Created,
            after: makeDocument(),
            controller: fakeController as never,
            eventId: "e1",
            origin: {
                context: { curriculumId: "c1" },
                initiator: EventChangeInitiator.GanttCut,
            },
        });

        expect(insertedRow().context).toEqual({ curriculumId: "c1" });
    });

    it("swallows a store failure — logging must never break the write", async () => {
        fakeHistory.insertOne.mockRejectedValueOnce(new Error("mongo down"));

        await expect(
            DbEventHistory.add({
                action: EventChangeAction.Created,
                after: makeDocument(),
                controller: fakeController as never,
                eventId: "e1",
                origin: { initiator: EventChangeInitiator.EventDialog },
            }),
        ).resolves.toBeUndefined();
    });
});

describe("DbEventHistory.recordBulk", () => {
    it("writes one row per event in a single insert", async () => {
        await DbEventHistory.recordBulk({
            action: EventChangeAction.Created,
            controller: fakeController as never,
            events: [
                { after: makeDocument({ id: "a" }), eventId: "a" },
                { after: makeDocument({ id: "b" }), eventId: "b" },
            ],
            origin: {
                context: { curriculumId: "c1" },
                initiator: EventChangeInitiator.GanttCut,
            },
        });

        expect(fakeHistory.insertMany).toHaveBeenCalledTimes(1);
        const rows = fakeHistory.insertMany.mock
            .calls[0][0] as Array<EventHistoryEntry>;
        expect(rows.map((r) => r.eventId)).toEqual(["a", "b"]);
        expect(new Set(rows.map((r) => r.id)).size).toBe(2);
        expect(rows.every((r) => r.initiator === EventChangeInitiator.GanttCut))
            .toBe(true);
    });

    it("drops no-op updates from the batch", async () => {
        await DbEventHistory.recordBulk({
            action: EventChangeAction.Updated,
            controller: fakeController as never,
            events: [
                {
                    after: makeDocument({ id: "a" }),
                    before: makeDocument({ id: "a" }),
                    eventId: "a",
                },
                {
                    after: makeDocument({ id: "b", name: "חדש" }),
                    before: makeDocument({ id: "b" }),
                    eventId: "b",
                },
            ],
            origin: { initiator: EventChangeInitiator.GanttReload },
        });

        const rows = fakeHistory.insertMany.mock
            .calls[0][0] as Array<EventHistoryEntry>;
        expect(rows.map((r) => r.eventId)).toEqual(["b"]);
    });

    it("writes nothing for an empty batch", async () => {
        await DbEventHistory.recordBulk({
            action: EventChangeAction.Archived,
            controller: fakeController as never,
            events: [],
            origin: { initiator: EventChangeInitiator.GanttPullBack },
        });

        expect(fakeHistory.insertMany).not.toHaveBeenCalled();
    });

    it("resolves the session actor once for the whole batch", async () => {
        await DbEventHistory.recordBulk({
            action: EventChangeAction.Created,
            controller: fakeController as never,
            events: [
                { after: makeDocument({ id: "a" }), eventId: "a" },
                { after: makeDocument({ id: "b" }), eventId: "b" },
                { after: makeDocument({ id: "c" }), eventId: "c" },
            ],
            origin: { initiator: EventChangeInitiator.GanttCut },
        });

        expect(getSessionUser).toHaveBeenCalledTimes(1);
    });

    it("uses a pre-resolved actor without touching the session", async () => {
        await DbEventHistory.recordBulk({
            action: EventChangeAction.Created,
            controller: fakeController as never,
            events: [{ after: makeDocument(), eventId: "e1" }],
            origin: {
                actor: { displayName: "אחר", id: "u9" },
                initiator: EventChangeInitiator.GanttReload,
            },
        });

        expect(getSessionUser).not.toHaveBeenCalled();
        const rows = fakeHistory.insertMany.mock
            .calls[0][0] as Array<EventHistoryEntry>;
        expect(rows[0]).toMatchObject({
            actorHiveId: null,
            actorId: "u9",
            actorName: "אחר",
        });
    });

    it("swallows a bulk store failure", async () => {
        fakeHistory.insertMany.mockRejectedValueOnce(new Error("mongo down"));

        await expect(
            DbEventHistory.recordBulk({
                action: EventChangeAction.Created,
                controller: fakeController as never,
                events: [{ after: makeDocument(), eventId: "e1" }],
                origin: { initiator: EventChangeInitiator.GanttCut },
            }),
        ).resolves.toBeUndefined();
    });
});

describe("DbEventHistory reads", () => {
    it("groups rows by event id", async () => {
        fakeHistory.find.mockReturnValueOnce({
            sort: vi.fn(),
            toArray: async () => [
                { eventId: "a", initiator: EventChangeInitiator.GanttCut },
                { eventId: "a", initiator: EventChangeInitiator.Resize },
                { eventId: "b", initiator: EventChangeInitiator.GanttCut },
            ],
        } as never);

        const grouped = await DbEventHistory.forEvents(
            ["a", "b"],
            fakeController as never,
        );

        expect(grouped.get("a")).toHaveLength(2);
        expect(grouped.get("b")).toHaveLength(1);
    });

    it("short-circuits an empty id list without querying", async () => {
        const grouped = await DbEventHistory.forEvents(
            [],
            fakeController as never,
        );

        expect(grouped.size).toBe(0);
        expect(fakeHistory.find).not.toHaveBeenCalled();
    });
});
