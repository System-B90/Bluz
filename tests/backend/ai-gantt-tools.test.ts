import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Unit tests for the Gantt half of the assistant. The tools wrap the real cut
 * pipeline, so what is worth pinning down is the boundary: which curriculum id
 * each call resolves, that the destructive cut goes through the same pipeline
 * the Gantt screen uses (never around it), and how refusals surface.
 */

const { dbCurriculum, cutPipeline, executionApi } = vi.hoisted(() => ({
    dbCurriculum: {
        listItems: vi.fn(),
        getItem: vi.fn(),
    },
    cutPipeline: {
        previewCurriculumCut: vi.fn(),
        cutCurriculumToSchedule: vi.fn(),
    },
    executionApi: {
        getCurriculumExecution: vi.fn(),
    },
}));

vi.mock("@/api-server/gantt/db-curriculum", () => ({
    DbCurriculum: dbCurriculum,
}));
vi.mock("@/api-server/gantt/cut", async (importOriginal) => {
    const actual =
        await importOriginal<typeof import("@/api-server/gantt/cut")>();
    return {
        ...actual,
        previewCurriculumCut: cutPipeline.previewCurriculumCut,
        cutCurriculumToSchedule: cutPipeline.cutCurriculumToSchedule,
    };
});
vi.mock("@/api-server/gantt/execution", () => ({
    getCurriculumExecution: executionApi.getCurriculumExecution,
}));

import type { CutOutcome } from "@/api-server/gantt/cut";
import {
    cutCurriculumTool,
    curriculumExecutionTool,
    GANTT_TOOLS,
    getCurriculumTool,
    listCurriculumsTool,
    previewCutTool,
} from "@/api-server/ai/tools/gantt";
import { AiToolContext } from "@/api-server/ai/tools/types";
import { AiToolKind } from "@/api-shared/types/ai";
import { ClientApiError } from "@/api-shared/errors";

const context = {
    actor: { id: "u1", displayName: "מיכאל" },
    iterationId: "2026b",
    // The user is on a Gantt screen — this is the fallback target.
    curriculumId: "c-screen",
    readController: vi.fn(async () => ({})),
    writeController: vi.fn(async () => ({})),
} as unknown as AiToolContext;

beforeEach(() => {
    vi.clearAllMocks();
});

describe("curriculum id resolution", () => {
    it("prefers an explicit argument over the open screen", async () => {
        dbCurriculum.getItem.mockResolvedValueOnce({ title: "תוכנית" });

        await getCurriculumTool.execute(
            { curriculumId: "c-explicit" },
            context,
        );

        expect(dbCurriculum.getItem).toHaveBeenCalledWith("c-explicit");
    });

    it("falls back to the gantt the user has open", async () => {
        dbCurriculum.getItem.mockResolvedValueOnce({ title: "תוכנית" });

        await getCurriculumTool.execute({}, context);

        expect(dbCurriculum.getItem).toHaveBeenCalledWith("c-screen");
    });

    it.each([
        [
            "get_curriculum",
            (ctx: AiToolContext) => getCurriculumTool.execute({}, ctx),
        ],
        [
            "preview_curriculum_cut",
            (ctx: AiToolContext) => previewCutTool.execute({}, ctx),
        ],
        [
            "cut_curriculum",
            (ctx: AiToolContext) => cutCurriculumTool.execute({}, ctx),
        ],
    ])("%s refuses to guess when no id exists anywhere", async (_name, run) => {
        const bareContext = {
            ...context,
            curriculumId: undefined,
        } as AiToolContext;

        await expect(run(bareContext)).rejects.toThrow(ClientApiError);
    });
});

describe("list_curriculums", () => {
    it("returns the id → title map and counts it in the summary", async () => {
        dbCurriculum.listItems.mockResolvedValueOnce({
            "c-1": "מסלול א׳",
            "c-2": "מסלול ב׳",
        });

        const result = await listCurriculumsTool.execute({}, context);

        expect(result.data).toEqual({ "c-1": "מסלול א׳", "c-2": "מסלול ב׳" });
        expect(result.summary).toContain("2");
    });
});

describe("get_curriculum", () => {
    it("loads the full tree and names it in the summary", async () => {
        dbCurriculum.getItem.mockResolvedValueOnce({ title: "מסלול א׳" });

        const result = await getCurriculumTool.execute(
            { curriculumId: "c-1" },
            context,
        );

        expect(result.data).toEqual({ title: "מסלול א׳" });
        expect(result.summary).toContain("מסלול א׳");
    });

    it("still names an untitled curriculum by its id", async () => {
        dbCurriculum.getItem.mockResolvedValueOnce({});

        const result = await getCurriculumTool.execute(
            { curriculumId: "c-bare" },
            context,
        );

        expect(result.summary).toContain("c-bare");
    });
});

describe("preview_curriculum_cut", () => {
    it("runs the dry-run through the real pipeline and returns it verbatim", async () => {
        const preview = { occurrences: [{ title: "שיעור" }] };
        cutPipeline.previewCurriculumCut.mockResolvedValueOnce(preview);

        const result = await previewCutTool.execute(
            { curriculumId: "c-1" },
            context,
        );

        expect(cutPipeline.previewCurriculumCut).toHaveBeenCalledWith("c-1");
        expect(cutPipeline.cutCurriculumToSchedule).not.toHaveBeenCalled();
        expect(result.data).toBe(preview);
    });
});

describe("get_curriculum_execution", () => {
    it("reports the planned-vs-executed gap per event", async () => {
        executionApi.getCurriculumExecution.mockResolvedValueOnce({
            events: { e1: {}, e2: {}, e3: {} },
        });

        const result = await curriculumExecutionTool.execute(
            { curriculumId: "c-1" },
            context,
        );

        expect(executionApi.getCurriculumExecution).toHaveBeenCalledWith("c-1");
        expect(result.data).toEqual({ events: { e1: {}, e2: {}, e3: {} } });
        expect(result.summary).toContain("3");
    });
});

describe("cut_curriculum", () => {
    const successOutcome = {
        ok: true,
        result: {
            createdEvents: 4,
            createdCourses: [],
            overlaps: 0,
            spilledEvents: 0,
            spills: [],
            insertedBreaks: 0,
        },
    } satisfies CutOutcome;
    const refusalOutcome = {
        ok: false,
        error: { code: "already-cut", message: "הגאנט כבר נגזר" },
    } satisfies CutOutcome;

    it("is a human-gated write, not a background read", () => {
        expect(cutCurriculumTool.kind).toBe(AiToolKind.Write);
        expect(listCurriculumsTool.kind).toBe(AiToolKind.Read);
        expect(previewCutTool.kind).toBe(AiToolKind.Read);
    });

    it("describes the exact cut for the approval prompt", () => {
        expect(
            cutCurriculumTool.describe?.({ curriculumId: "c-9" }, context),
        ).toContain("c-9");
    });

    it("invokes the shared pipeline with the resolved id", async () => {
        cutPipeline.cutCurriculumToSchedule.mockResolvedValueOnce(
            successOutcome,
        );

        const result = await cutCurriculumTool.execute(
            { curriculumId: "c-9" },
            context,
        );

        // Same entry point the Gantt screen uses — the assistant cannot
        // bypass the constraint engine or the draft guard.
        expect(cutPipeline.cutCurriculumToSchedule).toHaveBeenCalledTimes(1);
        // cutCurriculumToSchedule(id, options, context) — the assistant tags
        // its writes so the history shows who initiated them.
        expect(cutPipeline.cutCurriculumToSchedule).toHaveBeenCalledWith(
            "c-9",
            {},
            expect.objectContaining({ initiator: "ai-assistant" }),
        );
        expect(result.data).toEqual(successOutcome);
        expect(result.summary).toContain("נגזר");
    });

    it("surfaces an in-band refusal instead of throwing", async () => {
        cutPipeline.cutCurriculumToSchedule.mockResolvedValueOnce(
            refusalOutcome,
        );

        const result = await cutCurriculumTool.execute(
            { curriculumId: "c-9" },
            context,
        );

        expect(result.data).toEqual(refusalOutcome);
        expect(result.summary).toContain("הגאנט כבר נגזר");
    });

    it("lets a pipeline crash propagate as the tool's error", async () => {
        cutPipeline.cutCurriculumToSchedule.mockRejectedValueOnce(
            new Error("postgres unreachable"),
        );

        await expect(
            cutCurriculumTool.execute({ curriculumId: "c-9" }, context),
        ).rejects.toThrow("postgres unreachable");
    });
});

describe("GANTT_TOOLS registry", () => {
    it("exposes every gantt tool under its model-facing name", () => {
        expect(GANTT_TOOLS.map((tool) => tool.name)).toEqual([
            "list_curriculums",
            "get_curriculum",
            "preview_curriculum_cut",
            "get_curriculum_execution",
            "cut_curriculum",
        ]);
    });
});
