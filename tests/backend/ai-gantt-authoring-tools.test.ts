import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Unit tests for the gantt authoring tools (#719): the tree can be built end
 * to end (curriculum → syllabus → module → event), the create schemas enforce
 * what the database needs, and constraints go through the same validation as
 * the REST route.
 */

const mocks = vi.hoisted(() => {
    const entity = (prefix: string) => ({
        createNewItem: vi.fn(async (payload: Record<string, unknown>) => ({
            id: `${prefix}_1`,
            ...payload,
        })),
        updateItem: vi.fn(async (id: string, data: Record<string, unknown>) => ({
            id,
            title: "x",
            ...data,
        })),
        deleteItem: vi.fn(async () => undefined),
    });
    return {
        curriculum: {
            ...entity("c"),
            getItem: vi.fn(async () => ({
                id: "c_1",
                c2s: [{ syllabus: { id: "s_1", title: "יסודות" } }],
                c2w: [
                    { week: { id: "w_2", number: 2, comment: "", weekendDuty: false } },
                    { week: { id: "w_1", number: 1, comment: "", weekendDuty: true } },
                ],
            })),
        },
        syllabus: { ...entity("s"), reorderModules: vi.fn(), getItem: vi.fn() },
        module: { ...entity("m"), reorderEvents: vi.fn(), getItem: vi.fn() },
        event: { ...entity("e"), setAllocatedTime: vi.fn(), getItem: vi.fn() },
        week: {
            ...entity("w"),
            createNewItem: vi.fn(async () => ({
                id: "w_new",
                w2d: [
                    { day: { id: "d_sun", dayIndex: 0, totalWorkingMinutes: 480 } },
                    { day: { id: "d_fri", dayIndex: 5, totalWorkingMinutes: 300 } },
                ],
            })),
            getItem: vi.fn(),
        },
        day: { ...entity("d"), getItem: vi.fn() },
        createConstraint: vi.fn(async (row: unknown) => row),
    };
});

vi.mock("@/api-server/gantt/db-curriculum", () => ({ DbCurriculum: mocks.curriculum }));
vi.mock("@/api-server/gantt/db-syllabus", () => ({ DbSyllabus: mocks.syllabus }));
vi.mock("@/api-server/gantt/db-module", () => ({ DbModule: mocks.module }));
vi.mock("@/api-server/gantt/db-module-event", () => ({ DbModuleEvent: mocks.event }));
vi.mock("@/api-server/gantt/db-week", () => ({ DbWeek: mocks.week }));
vi.mock("@/api-server/gantt/db-day", () => ({ DbDay: mocks.day }));
vi.mock("@/api-server/gantt/db-constraints", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@/api-server/gantt/db-constraints")>()),
    createConstraint: mocks.createConstraint,
}));
vi.mock("@/api-server/gantt/cut", () => ({}));
vi.mock("@/api-server/gantt/execution", () => ({}));

import {
    applyCurriculumTemplateTool,
    createConstraintTool,
    GANTT_AUTHORING_TOOLS,
    listSyllabusesTool,
    listWeeksTool,
    reorderChildrenTool,
} from "@/api-server/ai/tools/gantt-authoring";
import { AiToolContext } from "@/api-server/ai/tools";
import { AiToolKind } from "@/api-shared/types/ai";
import { ModuleEventType } from "@/api-shared/types/gantt/models";

const context = {
    actor: { id: "u1", displayName: "מיכאל" },
    curriculumId: "c_1",
    readController: vi.fn(),
    writeController: vi.fn(),
} as unknown as AiToolContext;

const tool = (name: string) =>
    GANTT_AUTHORING_TOOLS.find((entry) => entry.name === name)!;

beforeEach(() => vi.clearAllMocks());

describe("reads", () => {
    it("lists the syllabuses of the curriculum on screen", async () => {
        const result = await listSyllabusesTool.execute({}, context);
        expect(mocks.curriculum.getItem).toHaveBeenCalledWith("c_1");
        expect((result.data as { items: unknown }).items).toEqual([
            { id: "s_1", title: "יסודות" },
        ]);
    });

    it("lists weeks in number order", async () => {
        const result = await listWeeksTool.execute({}, context);
        const items = (result.data as { items: Array<{ id: string }> }).items;
        expect(items.map((week) => week.id)).toEqual(["w_1", "w_2"]);
    });
});

describe("authoring the tree end to end", () => {
    it("registers a create/edit/delete for every level, all gated", () => {
        for (const level of ["curriculum", "syllabus", "module", "gantt_event"]) {
            for (const verb of ["create", "edit", "delete"]) {
                expect(tool(`${verb}_${level}`)?.kind).toBe(AiToolKind.Write);
            }
        }
    });

    it("links each level to its parent", async () => {
        await tool("create_curriculum").execute({ title: "גאנט" }, context);
        await tool("create_syllabus").execute(
            { curriculumId: "c_1", title: "סילבוס" },
            context,
        );
        await tool("create_module").execute({ syllabusId: "s_1", title: "מערך" }, context);
        await tool("create_gantt_event").execute(
            { moduleId: "m_1", title: "מופע", type: ModuleEventType.Lecture },
            context,
        );

        expect(mocks.curriculum.createNewItem.mock.calls[0][0]).toMatchObject({
            title: "גאנט",
            isDraft: true,
        });
        expect(mocks.syllabus.createNewItem.mock.calls[0][0]).toMatchObject({
            curriculumId: "c_1",
            hiveIds: [],
        });
        expect(mocks.module.createNewItem.mock.calls[0][0]).toMatchObject({
            syllabusId: "s_1",
        });
        expect(mocks.event.createNewItem.mock.calls[0][0]).toMatchObject({
            moduleId: "m_1",
            type: ModuleEventType.Lecture,
        });
    });

    it("requires a type on a gantt event, in the schema and at run time", async () => {
        const create = tool("create_gantt_event");
        expect((create.parameters as { required: Array<string> }).required).toContain(
            "type",
        );
        await expect(
            create.execute({ moduleId: "m_1", title: "מופע" }, context),
        ).rejects.toThrow("type");
        expect(mocks.event.createNewItem).not.toHaveBeenCalled();
    });

    it("writes allocated time as curriculum config, never as an event column", async () => {
        await tool("create_gantt_event").execute(
            {
                moduleId: "m_1",
                title: "מופע",
                type: ModuleEventType.Exercise,
                allocatedDuration: 90,
            },
            context,
        );
        expect(mocks.event.createNewItem.mock.calls[0][0]).not.toHaveProperty(
            "allocatedDuration",
        );
        expect(mocks.event.setAllocatedTime).toHaveBeenCalledWith("e_1", "c_1", 90);
    });

    it("edits only the fields given", async () => {
        await tool("edit_module").execute({ moduleId: "m_1", title: "חדש" }, context);
        expect(mocks.module.updateItem).toHaveBeenCalledWith("m_1", { title: "חדש" });
    });
});

describe("constraints", () => {
    it("maps an event-owned relational constraint the same way the route does", async () => {
        await createConstraintTool.execute(
            {
                ownerId: "e_1",
                ownerType: "event",
                type: "RELATIONAL" as never,
                targetId: "e_2",
                targetType: "event",
                relation: "after",
                minDelayDays: 1,
            },
            context,
        );
        expect(mocks.createConstraint.mock.calls[0][0]).toMatchObject({
            ownerEventId: "e_1",
            ownerModuleId: undefined,
            targetEventId: "e_2",
            relation: "after",
            minDelayDays: 1,
        });
    });

    it("refuses a relational constraint with no target", async () => {
        await expect(
            createConstraintTool.execute(
                { ownerId: "e_1", ownerType: "event", type: "RELATIONAL" as never },
                context,
            ),
        ).rejects.toThrow("targetId");
    });
});

describe("weeks, templates and ordering", () => {
    it("seeds weeks from a template and fixes only the days that differ", async () => {
        await applyCurriculumTemplateTool.execute({ templateId: "hachnas" }, context);
        expect(mocks.week.createNewItem).toHaveBeenCalledTimes(8);
        expect(mocks.week.createNewItem.mock.calls[0][0]).toMatchObject({
            curriculumId: "c_1",
            number: 1,
        });
        // Sunday 480 → 540 differs; Friday is already 300.
        const updatedDays = mocks.day.updateItem.mock.calls.map((call) => call[0]);
        expect(updatedDays).toContain("d_sun");
        expect(updatedDays).not.toContain("d_fri");
    });

    it("reorders modules in a syllabus and events in a module", async () => {
        await reorderChildrenTool.execute(
            { parentType: "syllabus", parentId: "s_1", childIds: ["m_2", "m_1"] },
            context,
        );
        await reorderChildrenTool.execute(
            { parentType: "module", parentId: "m_1", childIds: ["e_2"] },
            context,
        );
        expect(mocks.syllabus.reorderModules).toHaveBeenCalledWith("s_1", ["m_2", "m_1"]);
        expect(mocks.module.reorderEvents).toHaveBeenCalledWith("m_1", ["e_2"]);
    });
});
