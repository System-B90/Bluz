import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Verifies that every schedule-event write path feeds the change log with the
 * right action, before/after pair and declared initiator — the log the gantt
 * reload later reads to decide what it may overwrite.
 */

const { fakeController, fakeEvents } = vi.hoisted(() => {
    const events = {
        findOne: vi.fn(async () => null as unknown),
        insertOne: vi.fn(async () => ({ insertedId: "x" })),
        updateOne: vi.fn(async () => ({ matchedCount: 1, modifiedCount: 1 })),
    };
    return {
        fakeController: { dbName: "bluz_test", events },
        fakeEvents: events,
    };
});

vi.mock("@/api-server/mongo-db-controller", () => ({
    databaseController: fakeController,
    getDatabaseController: vi.fn(() => fakeController),
}));
vi.mock("@/api-server/web-socket-utils", () => ({
    // The student refresh ping (#656) is a second network side effect on the
    // same write paths; stubbed alongside the broadcast.
    NotifyStudentsOfCalendarChange: vi.fn(),
    SendServerRequestToSessionServer: vi.fn(),
}));
vi.mock("@/api-server/db-event-history", () => ({
    DbEventHistory: { add: vi.fn(async () => {}), recordBulk: vi.fn(async () => {}) },
    UNKNOWN_ORIGIN: { initiator: "unknown" },
}));

import { DbEvent } from "@/api-server/db-event";
import { DbEventHistory } from "@/api-server/db-event-history";
import { DbEventDocument, EventType } from "@/api-shared/types/event";
import {
    EventChangeAction,
    EventChangeInitiator,
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

beforeEach(() => {
    vi.clearAllMocks();
    fakeEvents.findOne.mockResolvedValue(null);
    fakeEvents.updateOne.mockResolvedValue({
        matchedCount: 1,
        modifiedCount: 1,
    });
});

describe("DbEvent.create", () => {
    it("logs a creation with the declared initiator", async () => {
        await DbEvent.create(
            makeDocument(),
            undefined,
            fakeController as never,
            undefined,
            { initiator: EventChangeInitiator.CopyPaste },
        );

        expect(DbEventHistory.add).toHaveBeenCalledWith(
            expect.objectContaining({
                action: EventChangeAction.Created,
                eventId: "e1",
                origin: { initiator: EventChangeInitiator.CopyPaste },
            }),
        );
    });

    it("falls back to the unknown origin when no initiator is declared", async () => {
        await DbEvent.create(makeDocument(), undefined, fakeController as never);

        expect(DbEventHistory.add).toHaveBeenCalledWith(
            expect.objectContaining({
                origin: { initiator: EventChangeInitiator.Unknown },
            }),
        );
    });
});

describe("DbEvent.set", () => {
    it("reads the stored copy and logs it as the diff baseline", async () => {
        const stored = makeDocument({ name: "ישן" });
        fakeEvents.findOne.mockResolvedValue(stored);

        await DbEvent.set(
            makeDocument({ name: "חדש" }),
            undefined,
            fakeController as never,
            undefined,
            { initiator: EventChangeInitiator.DragDrop },
        );

        const call = vi.mocked(DbEventHistory.add).mock.calls[0][0];
        expect(call).toMatchObject({
            action: EventChangeAction.Updated,
            before: stored,
            eventId: "e1",
            origin: { initiator: EventChangeInitiator.DragDrop },
        });
        expect(call.after?.name).toBe("חדש");
    });

    it("does not log when the event does not exist (write rejected)", async () => {
        fakeEvents.updateOne.mockResolvedValue({
            matchedCount: 0,
            modifiedCount: 0,
        });

        await expect(
            DbEvent.set(makeDocument(), undefined, fakeController as never),
        ).rejects.toThrow();
        expect(DbEventHistory.add).not.toHaveBeenCalled();
    });
});

describe("DbEvent.del", () => {
    it("logs an archival with the declared initiator", async () => {
        await DbEvent.del(
            "e1",
            undefined,
            fakeController as never,
            undefined,
            { initiator: EventChangeInitiator.Keyboard },
        );

        expect(DbEventHistory.add).toHaveBeenCalledWith(
            expect.objectContaining({
                action: EventChangeAction.Archived,
                eventId: "e1",
                origin: { initiator: EventChangeInitiator.Keyboard },
            }),
        );
    });

    it("does not log when nothing was archived", async () => {
        fakeEvents.updateOne.mockResolvedValue({
            matchedCount: 0,
            modifiedCount: 0,
        });

        await expect(
            DbEvent.del("missing", undefined, fakeController as never),
        ).rejects.toThrow();
        expect(DbEventHistory.add).not.toHaveBeenCalled();
    });
});
