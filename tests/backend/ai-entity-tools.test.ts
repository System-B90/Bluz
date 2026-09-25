import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Unit tests for the calendar entity and Hive tools (#719). They wrap existing
 * controllers, so what is pinned here is the boundary: every write goes
 * through the writable-iteration controller, updates are partial, lists are
 * paged, and the dangerous ones are marked so.
 */

const mocks = vi.hoisted(() => ({
    courses: {
        get: vi.fn(async () => [
            { id: "course-1", name: "א", color: null, description: "ישן" },
        ]),
        create: vi.fn(async (item: unknown) => item),
        set: vi.fn(async () => undefined),
        del: vi.fn(async () => undefined),
    },
    outsiders: { get: vi.fn(async () => []), create: vi.fn(), set: vi.fn(), del: vi.fn() },
    rooms: { get: vi.fn(async () => []), create: vi.fn(async (item: unknown) => item), set: vi.fn(), del: vi.fn() },
    snapshots: {
        list: vi.fn(async () => []),
        create: vi.fn(async (label: string) => ({ id: "s1", label })),
        restore: vi.fn(async () => ({ restoredCount: 4, removedCount: 2 })),
    },
    drafts: { list: vi.fn(), create: vi.fn(async (label: string) => ({ id: "d1", label })), del: vi.fn() },
    event: { getInRange: vi.fn(async () => [{ id: "e1" }]) },
    settings: { get: vi.fn(async () => ({ breakfast: "07:00" })) },
    hive: {
        getSubjects: vi.fn(async () =>
            Array.from({ length: 60 }, (_, index) => ({
                id: index,
                name: `מקצוע ${index}`,
                huge: "x".repeat(50),
            })),
        ),
    },
}));

vi.mock("@/api-server/db-courses", () => ({ DbCourses: mocks.courses }));
vi.mock("@/api-server/db-outsiders", () => ({ DbOutsiders: mocks.outsiders }));
vi.mock("@/api-server/db-rooms", () => ({ DbRooms: mocks.rooms }));
vi.mock("@/api-server/db-calendar-snapshot", () => ({
    DbCalendarSnapshot: mocks.snapshots,
}));
vi.mock("@/api-server/db-calendar-draft", () => ({ DbCalendarDraft: mocks.drafts }));
vi.mock("@/api-server/db-event", () => ({ DbEvent: mocks.event }));
vi.mock("@/api-server/db-settings", () => ({ DbSettings: mocks.settings }));
vi.mock("@/api-server/hive/session-client", () => ({
    createHiveClient: async () => mocks.hive,
}));

import {
    COURSE_TOOLS,
    createCalendarDraftTool,
    createCalendarSnapshotTool,
    getSettingsTool,
    restoreCalendarSnapshotTool,
    ROOM_TOOLS,
} from "@/api-server/ai/tools/calendar-entities";
import { listHiveSubjectsTool } from "@/api-server/ai/tools/hive";
import { AiToolContext } from "@/api-server/ai/tools";
import { AiToolDanger, AiToolKind } from "@/api-shared/types/ai";
import { RoomSource } from "@/api-shared/types/room";

const readController = { dbName: "read" };
const writeController = { dbName: "write" };

const context = {
    actor: { id: "u1", displayName: "מיכאל" },
    iterationId: "2026b",
    readController: vi.fn(async () => readController),
    writeController: vi.fn(async () => writeController),
} as unknown as AiToolContext;

const tool = (tools: typeof COURSE_TOOLS, name: string) =>
    tools.find((entry) => entry.name === name)!;

beforeEach(() => vi.clearAllMocks());

describe("directory tools", () => {
    it("registers list/create/update/delete for courses, and deletes as destructive", () => {
        expect(COURSE_TOOLS.map((entry) => entry.name)).toEqual([
            "list_courses",
            "create_course",
            "update_course",
            "delete_course",
        ]);
        expect(tool(COURSE_TOOLS, "delete_course").danger).toBe(
            AiToolDanger.Destructive,
        );
        expect(tool(COURSE_TOOLS, "create_course").kind).toBe(AiToolKind.Write);
    });

    it("creates with a prefixed id through the writable controller", async () => {
        await tool(COURSE_TOOLS, "create_course").execute({ name: "ב" }, context);
        const [course, controller] = mocks.courses.create.mock.calls[0];
        expect(controller).toBe(writeController);
        expect(course).toMatchObject({ name: "ב", color: null });
        expect(course.id).toMatch(/^course-/);
    });

    it("refuses a create with no name", async () => {
        await expect(
            tool(COURSE_TOOLS, "create_course").execute({ name: " " }, context),
        ).rejects.toThrow("חובה");
    });

    it("updates only the fields given", async () => {
        await tool(COURSE_TOOLS, "update_course").execute(
            { id: "course-1", name: "חדש" },
            context,
        );
        expect(mocks.courses.set.mock.calls[0][0]).toEqual({
            id: "course-1",
            name: "חדש",
            color: null,
            description: "ישן",
        });
    });

    it("reports an unknown id as not found", async () => {
        await expect(
            tool(COURSE_TOOLS, "delete_course").execute({ id: "x" }, context),
        ).rejects.toThrow("לא נמצא");
        expect(mocks.courses.del).not.toHaveBeenCalled();
    });

    it("creates only custom rooms and leaves listing to list_rooms", async () => {
        expect(ROOM_TOOLS.some((entry) => entry.name.startsWith("list_"))).toBe(false);
        await tool(ROOM_TOOLS, "create_room").execute({ name: "מעבדה" }, context);
        expect(mocks.rooms.create.mock.calls[0][0]).toMatchObject({
            source: RoomSource.Custom,
        });
    });
});

describe("snapshots and drafts", () => {
    it("captures the live events of the range into a snapshot", async () => {
        await createCalendarSnapshotTool.execute(
            { label: "לפני", from: "2026-03-01T00:00:00Z", to: "2026-03-08T00:00:00Z" },
            context,
        );
        expect(mocks.event.getInRange.mock.calls[0][2]).toEqual({
            projection: { _id: 0 },
        });
        expect(mocks.snapshots.create).toHaveBeenCalledWith(
            "לפני",
            [{ id: "e1" }],
            writeController,
            "2026b",
        );
    });

    it("marks restore as destructive and reports what it replaced", async () => {
        expect(restoreCalendarSnapshotTool.danger).toBe(AiToolDanger.Destructive);
        const result = await restoreCalendarSnapshotTool.execute(
            { id: "s1" },
            context,
        );
        expect(result.summary).toContain("4");
        expect(result.summary).toContain("2");
    });

    it("refuses a draft with only one end of the range", async () => {
        await expect(
            createCalendarDraftTool.execute(
                { label: "ט", from: "2026-03-01T00:00:00Z" },
                context,
            ),
        ).rejects.toThrow();
        expect(mocks.drafts.create).not.toHaveBeenCalled();
    });

    it("attributes a draft to the signed-in staff member", async () => {
        await createCalendarDraftTool.execute({ label: "ט" }, context);
        expect(mocks.drafts.create.mock.calls[0][2]).toEqual({
            id: "u1",
            displayName: "מיכאל",
        });
    });
});

describe("get_settings", () => {
    it("reads a known setting through the read controller", async () => {
        await getSettingsTool.execute({ name: "mealTimes" }, context);
        expect(mocks.settings.get).toHaveBeenCalledWith(
            "mealTimes",
            undefined,
            readController,
        );
    });

    it("refuses an unknown setting name", async () => {
        await expect(
            getSettingsTool.execute({ name: "secrets" as never }, context),
        ).rejects.toThrow("לא מוכרת");
    });
});

describe("hive tools", () => {
    it("pages Hive data and projects away wide fields", async () => {
        const result = await listHiveSubjectsTool.execute({}, context);
        const page = result.data as {
            items: Array<Record<string, unknown>>;
            total: number;
            nextOffset?: number;
        };
        expect(page.total).toBe(60);
        expect(page.items).toHaveLength(50);
        expect(page.nextOffset).toBe(50);
        expect(page.items[0]).toEqual({ id: 0, name: "מקצוע 0" });
    });
});
