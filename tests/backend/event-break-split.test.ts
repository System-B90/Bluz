import { describe, it, expect, vi, beforeEach } from "vitest";

// The session-server broadcast is a network side effect; stub it out.
vi.mock("@/api-server/web-socket-utils", () => ({
    SendServerRequestToSessionServer: vi.fn(),
}));

import { DbEvent, DbEventDocument } from "@/api-server/db-event";
import { DatabaseController } from "@/api-server/mongo-db-controller";
import { EventType } from "@/api-shared/types/event";

type MockController = {
    events: {
        findOne: ReturnType<typeof vi.fn>;
        find: ReturnType<typeof vi.fn>;
        updateOne: ReturnType<typeof vi.fn>;
        insertOne: ReturnType<typeof vi.fn>;
    };
};

function makeController(breakDocs: Array<Partial<DbEventDocument>>): MockController {
    return {
        events: {
            findOne: vi.fn(async () => null),
            find: vi.fn(() => ({
                toArray: async () => breakDocs,
            })),
            updateOne: vi.fn(async () => ({ matchedCount: 1 })),
            insertOne: vi.fn(async () => undefined),
        },
    };
}

function makeEvent(overrides: Partial<DbEventDocument> = {}): DbEventDocument {
    return {
        id: "e1",
        name: "Exercise",
        subject: 1,
        hiveModule: 1,
        hiveLesson: null,
        startTime: new Date("2026-06-01T12:15:00"),
        endTime: new Date("2026-06-01T13:45:00"), // 90 minutes
        type: EventType.EXERCISE,
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
        splitAcrossBreaks: true,
        ...overrides,
    };
}

let controller: MockController;

describe("split-across-breaks wiring in DbEvent.create/set", () => {
    beforeEach(() => {
        controller = makeController([
            {
                type: EventType.BREAK,
                startTime: new Date("2026-06-01T13:00:00"),
                endTime: new Date("2026-06-01T13:30:00"),
            } as DbEventDocument,
        ]);
    });

    it("extends endTime past an overlapping break on create when splitAcrossBreaks is set", async () => {
        const created = await DbEvent.create(
            makeEvent(),
            undefined,
            controller as unknown as DatabaseController,
        );
        expect(created.endTime).toEqual(new Date("2026-06-01T14:15:00"));
        expect(created.startTime).toEqual(new Date("2026-06-01T12:15:00"));
    });

    it("extends endTime past an overlapping break on update when splitAcrossBreaks is set", async () => {
        const updated = await DbEvent.set(
            makeEvent(),
            undefined,
            controller as unknown as DatabaseController,
        );
        expect(updated.endTime).toEqual(new Date("2026-06-01T14:15:00"));
    });

    it("leaves endTime untouched when splitAcrossBreaks is off", async () => {
        const created = await DbEvent.create(
            makeEvent({ splitAcrossBreaks: false }),
            undefined,
            controller as unknown as DatabaseController,
        );
        expect(created.endTime).toEqual(new Date("2026-06-01T13:45:00"));
    });

    it("never adjusts a break event itself, even if flagged", async () => {
        const created = await DbEvent.create(
            makeEvent({ type: EventType.BREAK, splitAcrossBreaks: true }),
            undefined,
            controller as unknown as DatabaseController,
        );
        expect(created.endTime).toEqual(new Date("2026-06-01T13:45:00"));
    });

    it("leaves endTime untouched when no break overlaps that day", async () => {
        controller = makeController([]);
        const created = await DbEvent.create(
            makeEvent(),
            undefined,
            controller as unknown as DatabaseController,
        );
        expect(created.endTime).toEqual(new Date("2026-06-01T13:45:00"));
    });
});
