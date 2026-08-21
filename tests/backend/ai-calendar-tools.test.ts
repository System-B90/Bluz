import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Unit tests for the calendar tools. These wrap existing controllers, so the
 * behaviour worth pinning down is the boundary: what the model is allowed to
 * put into a query, and that every write is attributed and routed through the
 * writable-iteration controller.
 */

const { dbEvent, dbRooms, dbIterations } = vi.hoisted(() => ({
    dbEvent: {
        get: vi.fn(),
        getInRange: vi.fn(async () => []),
        set: vi.fn(async (event: unknown) => event),
        del: vi.fn(async () => undefined),
        create: vi.fn(async (event: unknown) => event),
    },
    dbRooms: { get: vi.fn(async () => []) },
    dbIterations: { list: vi.fn(async () => []) },
}));

vi.mock("@/api-server/db-event", () => ({ DbEvent: dbEvent }));
vi.mock("@/api-server/db-rooms", () => ({ DbRooms: dbRooms }));
vi.mock("@/api-server/db-iterations", () => ({ DbIterations: dbIterations }));

import {
    createEventTool,
    deleteEventTool,
    listEventsTool,
    listIterationsTool,
    updateEventTool,
} from "@/api-server/ai/tools/calendar";
import { AiToolContext } from "@/api-server/ai/tools";
import { ClientApiError } from "@/api-shared/errors";
import { EventType } from "@/api-shared/types/event";
import { EventChangeInitiator } from "@/api-shared/types/event-history";

const readController = { dbName: "read" };
const writeController = { dbName: "write" };

const context = {
    actor: { id: "u1", displayName: "מיכאל" },
    iterationId: "2026b",
    readController: vi.fn(async () => readController),
    writeController: vi.fn(async () => writeController),
} as unknown as AiToolContext;

/** The Mongo filter `list_events` handed to the controller. */
function filterOf() {
    return dbEvent.getInRange.mock.calls[0][3];
}

const RANGE = { from: "2026-03-01T00:00:00Z", to: "2026-03-08T00:00:00Z" };

const existingEvent = {
    id: "e1",
    name: "שיעור",
    type: EventType.LECTURE,
    startTime: new Date("2026-03-02T09:00:00Z"),
    endTime: new Date("2026-03-02T10:00:00Z"),
    rooms: [],
    courses: [],
    instructors: [],
    tags: [],
    notes: "הערה",
    locked: false,
};

beforeEach(() => {
    vi.clearAllMocks();
    dbEvent.get.mockResolvedValue({ ...existingEvent });
});

describe("list_events", () => {
    it("reads through the read controller, not the writable one", async () => {
        await listEventsTool.execute(RANGE, context);

        expect(context.readController).toHaveBeenCalled();
        expect(context.writeController).not.toHaveBeenCalled();
        expect(dbEvent.getInRange.mock.calls[0][4]).toBe(readController);
    });

    it("passes no filter when the model gives no search text", async () => {
        await listEventsTool.execute(RANGE, context);
        expect(filterOf()).toBeUndefined();
    });

    it("escapes regex metacharacters in the search text", async () => {
        // The model relays what the user typed, so `(a+)+b` would otherwise
        // reach the matcher and backtrack catastrophically.
        await listEventsTool.execute(
            { ...RANGE, nameContains: "(a+)+b" },
            context,
        );

        expect(filterOf().name.$regex).toBe("\\(a\\+\\)\\+b");
    });

    it("escapes a wildcard so a search cannot silently widen", async () => {
        await listEventsTool.execute({ ...RANGE, nameContains: ".*" }, context);
        expect(filterOf().name.$regex).toBe("\\.\\*");
    });

    it("still matches an ordinary Hebrew search term", async () => {
        await listEventsTool.execute(
            { ...RANGE, nameContains: "תפיל" },
            context,
        );

        const { $regex, $options } = filterOf().name;
        expect($regex).toBe("תפיל");
        expect(new RegExp($regex, $options).test("תפילת שחרית")).toBe(true);
    });

    it("rejects a date the model invented in the wrong format", async () => {
        await expect(
            listEventsTool.execute({ from: "yesterday", to: "today" }, context),
        ).rejects.toThrow(ClientApiError);
    });
});

describe("write tools", () => {
    it("creates through the writable controller with a generated id", async () => {
        const result = await createEventTool.execute(
            {
                name: "מפגש",
                startTime: "2026-03-02T09:00:00Z",
                endTime: "2026-03-02T10:00:00Z",
            },
            context,
        );

        expect(context.writeController).toHaveBeenCalled();
        const [event, , controller, iterationId, origin] =
            dbEvent.create.mock.calls[0];
        expect(controller).toBe(writeController);
        expect(iterationId).toBe("2026b");
        expect(event.id).toMatch(/^[0-9a-f-]{36}$/);
        expect(event.type).toBe(EventType.OTHER);
        // Every assistant write is attributable in the history log.
        expect(origin).toEqual({
            initiator: EventChangeInitiator.AiAssistant,
            actor: { id: "u1", displayName: "מיכאל" },
        });
        expect(result.summary).toContain("מפגש");
    });

    it("patches only the named fields and leaves the rest untouched", async () => {
        await updateEventTool.execute(
            { id: "e1", startTime: "2026-03-02T11:00:00Z" },
            context,
        );

        const [saved] = dbEvent.set.mock.calls[0];
        expect(saved.startTime.toISOString()).toBe("2026-03-02T11:00:00.000Z");
        // Untouched fields survive: the model is told to send only changes.
        expect(saved.name).toBe("שיעור");
        expect(saved.notes).toBe("הערה");
        expect(saved.endTime).toEqual(existingEvent.endTime);
    });

    it("refuses to update an event that does not exist", async () => {
        dbEvent.get.mockResolvedValueOnce(null);
        await expect(
            updateEventTool.execute({ id: "missing" }, context),
        ).rejects.toThrow(ClientApiError);
        expect(dbEvent.set).not.toHaveBeenCalled();
    });

    it("refuses to delete an event that does not exist", async () => {
        dbEvent.get.mockResolvedValueOnce(null);
        await expect(
            deleteEventTool.execute({ id: "missing" }, context),
        ).rejects.toThrow(ClientApiError);
        expect(dbEvent.del).not.toHaveBeenCalled();
    });

    it("names the deleted event so the transcript stays readable", async () => {
        const result = await deleteEventTool.execute({ id: "e1" }, context);
        expect(result.summary).toContain("שיעור");
        expect(dbEvent.del.mock.calls[0][2]).toBe(writeController);
    });

    it("describes a write before it is approved", async () => {
        // This string is what the human reads in the approval prompt.
        expect(
            createEventTool.describe?.(
                {
                    name: "מפגש",
                    startTime: "2026-03-02T09:00:00Z",
                    endTime: "2026-03-02T10:00:00Z",
                },
                context,
            ),
        ).toContain("מפגש");
    });
});

describe("list_iterations", () => {
    it("returns only the fields the model needs", async () => {
        dbIterations.list.mockResolvedValueOnce([
            {
                id: "2026b",
                label: "מחזור 2026 ב'",
                isCurrent: true,
                ganttCurriculumId: "c-1",
                dbName: "bluz_2026b",
                hiveCache: { huge: true },
            },
        ]);

        const result = await listIterationsTool.execute({}, context);
        expect(result.data).toEqual([
            {
                id: "2026b",
                label: "מחזור 2026 ב'",
                isCurrent: true,
                curriculumId: "c-1",
            },
        ]);
    });
});
