import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/api-server/gantt/cut", () => ({
    cutCurriculumToSchedule: vi.fn(),
}));

import { cutCurriculumToSchedule } from "@/api-server/gantt/cut";
import * as CutRoute from "@/app/api/gantt/curriculums/[id]/cut/route";

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const post = (id: string) =>
    CutRoute.POST(
        new NextRequest(`http://localhost/api/gantt/curriculums/${id}/cut`, {
            method: "POST",
        }) as any,
        ctx(id) as any,
    );

beforeEach(() => vi.clearAllMocks());

describe("POST /api/gantt/curriculums/[id]/cut", () => {
    it("returns 200 with the cut summary on success", async () => {
        vi.mocked(cutCurriculumToSchedule).mockResolvedValue({
            ok: true,
            result: { createdEvents: 4, createdCourses: [], overlaps: 0 },
        } as any);

        const res = await post("c1");
        const body = await res.json();
        expect(res.status).toBe(200);
        expect(body.data.createdEvents).toBe(4);
        expect(cutCurriculumToSchedule).toHaveBeenCalledWith("c1");
    });

    it.each([
        ["draft", 409],
        ["no-iteration", 409],
        ["already-cut", 409],
        ["invalid-plan", 400],
    ] as const)("maps coded error %s to HTTP %i", async (code, status) => {
        vi.mocked(cutCurriculumToSchedule).mockResolvedValue({
            ok: false,
            error: { code, message: "x" },
        } as any);

        const res = await post("c1");
        const body = await res.json();
        expect(res.status).toBe(status);
        expect(body.error.code).toBe(code);
    });

    it("carries the planner validation errors in the invalid-plan body", async () => {
        vi.mocked(cutCurriculumToSchedule).mockResolvedValue({
            ok: false,
            error: {
                code: "invalid-plan",
                errors: [{ type: "missing-start-date" }],
            },
        } as any);

        const res = await post("c1");
        const body = await res.json();
        expect(res.status).toBe(400);
        expect(body.error.errors).toEqual([{ type: "missing-start-date" }]);
    });
});
