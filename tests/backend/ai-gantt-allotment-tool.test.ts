import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * #857: the AI can set an event's allotted minutes per (curriculum, event, day)
 * mapping, placing the event on the day when it is not there yet.
 */

const db = vi.hoisted(() => ({
    getModuleDayMappingsForCurriculum: vi.fn(),
    updateCurriculumModuleDayMapping: vi.fn(async () => []),
    createCurriculumModuleDayMapping: vi.fn(async () => []),
}));
vi.mock("@/api-server/gantt/db-mappings", () => db);
vi.mock("@/api-server/gantt/db-curriculum", () => ({ DbCurriculum: {} }));
vi.mock("@/api-server/gantt/cut", () => ({}));
vi.mock("@/api-server/gantt/execution", () => ({}));

import { setGanttEventAllottedTimeTool as tool } from "@/api-server/ai/tools/gantt-allotment";
import { findTool } from "@/api-server/ai/tools";
import { buildSystemPrompt } from "@/api-server/ai/system-prompt";

const context = { curriculumId: "c1", actor: { id: "u", displayName: "u" } } as never;
const args = { moduleId: "m1", eventId: "e1", dayId: "d1", minutes: 90 };

beforeEach(() => vi.clearAllMocks());

describe("set_gantt_event_allotted_time (#857)", () => {
    it("is registered as an approval-gated write", () => {
        expect(findTool("set_gantt_event_allotted_time")).toBe(tool);
        expect(tool.kind).toBe("write");
    });

    it("updates an existing mapping and reports the previous value", async () => {
        db.getModuleDayMappingsForCurriculum.mockResolvedValue([
            { eventId: "e1", moduleId: "m1", dayId: "d1", allottedMinutes: 60 },
        ]);
        const result = await tool.execute(args, context);
        expect(db.getModuleDayMappingsForCurriculum).toHaveBeenCalledWith("c1", { dayIds: [ "d1" ] });
        expect(db.updateCurriculumModuleDayMapping).toHaveBeenCalledWith("c1", "m1", "e1", { dayId: "d1" }, { allottedMinutes: 90 });
        expect(db.createCurriculumModuleDayMapping).not.toHaveBeenCalled();
        expect(result.data).toMatchObject({ previousMinutes: 60, placed: false });
    });

    it("places the event on the day when it has no mapping there", async () => {
        db.getModuleDayMappingsForCurriculum.mockResolvedValue([
            { eventId: "other", moduleId: "m1", dayId: "d1", allottedMinutes: 30 },
        ]);
        const result = await tool.execute(args, context);
        expect(db.createCurriculumModuleDayMapping).toHaveBeenCalledWith({
            curriculumId: "c1", moduleId: "m1", eventId: "e1", dayId: "d1", allottedMinutes: 90,
        });
        expect(result.data).toMatchObject({ previousMinutes: null, placed: true });
    });

    it("an explicit curriculumId wins over the screen's", async () => {
        db.getModuleDayMappingsForCurriculum.mockResolvedValue([]);
        await tool.execute({ ...args, curriculumId: "c2" }, context);
        expect(db.createCurriculumModuleDayMapping).toHaveBeenCalledWith(expect.objectContaining({ curriculumId: "c2" }));
    });

    it("warns in the approval impact that 0 leaves the event out of the cut", () => {
        expect(tool.impact?.({ ...args, minutes: 0 }).join(" ")).toContain("לא ייכלל בגזירה");
        expect(tool.impact?.(args)).toHaveLength(1);
    });

    it("rejects negative minutes in the schema", () => {
        expect((tool.parameters as { properties: { minutes: { minimum: number } } }).properties.minutes.minimum).toBe(0);
    });

    it("the system prompt points event time at the new tool", () => {
        expect(buildSystemPrompt(context)).toContain("set_gantt_event_allotted_time");
    });
});