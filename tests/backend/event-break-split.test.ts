import { describe, it, expect, vi, beforeEach } from "vitest";

// The session-server broadcast is a network side effect; stub it out.
vi.mock("@/api-server/web-socket-utils", () => ({
    SendServerRequestToSessionServer: vi.fn(),
}));

import { DbEvent, DbEventDocument } from "@/api-server/db-event";
import { DatabaseController } from "@/api-server/mongo-db-controller";
import { EventType } from "@/api-shared/types/event";

/**
 * An event's stored span is its *net working time*, whatever breaks it happens
 * to run into — those are drawn around at render time. Persistence must
 * therefore keep its hands off `endTime`: writing break length into it is what
 * made an event grow a little on every save, and would let one event's move
 * silently change another's duration.
 */

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

const NINETY_MINUTES = 90 * 60 * 1000;

let controller: MockController;

describe("DbEvent persists the net working span, breaks or not", () => {
    beforeEach(() => {
        controller = makeController([
            {
                type: EventType.BREAK,
                startTime: new Date("2026-06-01T13:00:00"),
                endTime: new Date("2026-06-01T13:30:00"),
            } as DbEventDocument,
        ]);
    });

    it("stores the given span on create, even with an overlapping break", async () => {
        const created = await DbEvent.create(
            makeEvent(),
            undefined,
            controller as unknown as DatabaseController,
        );

        expect(created.startTime).toEqual(new Date("2026-06-01T12:15:00"));
        expect(created.endTime).toEqual(new Date("2026-06-01T13:45:00"));
    });

    it("stores the given span on update, even with an overlapping break", async () => {
        const updated = await DbEvent.set(
            makeEvent(),
            undefined,
            controller as unknown as DatabaseController,
        );

        expect(updated.endTime).toEqual(new Date("2026-06-01T13:45:00"));
    });

    it("is idempotent: re-saving an unchanged event never grows it", async () => {
        let event = makeEvent();
        for (let save = 0; save < 5; save++) {
            event = await DbEvent.set(
                event,
                undefined,
                controller as unknown as DatabaseController,
            );
        }

        expect(event.endTime.getTime() - event.startTime.getTime()).toBe(
            NINETY_MINUTES,
        );
    });

    it("treats a split-disabled event identically", async () => {
        const created = await DbEvent.create(
            makeEvent({ splitAcrossBreaks: false }),
            undefined,
            controller as unknown as DatabaseController,
        );

        expect(created.endTime).toEqual(new Date("2026-06-01T13:45:00"));
    });

    it("does not query for breaks at all", async () => {
        await DbEvent.create(
            makeEvent(),
            undefined,
            controller as unknown as DatabaseController,
        );

        expect(controller.events.find).not.toHaveBeenCalled();
    });
});
