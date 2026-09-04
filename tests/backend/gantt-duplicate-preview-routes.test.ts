import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/api-server/gantt/db-curriculum", () => ({
    DbCurriculum: { duplicateCurriculum: vi.fn() },
}));
vi.mock("@/api-server/gantt/cut", () => ({ previewCurriculumCut: vi.fn() }));
vi.mock("@/api-server/session-user", () => ({
    requireStaffSession: vi.fn(async () => undefined),
    getSessionUser: vi.fn(async () => ({ id: "u1" })),
}));

import { previewCurriculumCut } from "@/api-server/gantt/cut";
import { DbCurriculum } from "@/api-server/gantt/db-curriculum";
import * as PreviewRoute from "@/app/api/gantt/curriculums/[id]/cut/preview/route";
import * as DuplicateRoute from "@/app/api/gantt/curriculums/[id]/duplicate/route";

const context = (id = "c1") => ({ params: Promise.resolve({ id }) });

function request(method: string, body?: string) {
    return new NextRequest("http://localhost/api/gantt/curriculums/c1", {
        method,
        body,
    });
}

beforeEach(() => vi.clearAllMocks());

describe("POST /api/gantt/curriculums/[id]/duplicate", () => {
    it("duplicates with the supplied overrides", async () => {
        vi.mocked(DbCurriculum.duplicateCurriculum).mockResolvedValueOnce({
            id: "c2",
        } as never);

        const response = await DuplicateRoute.POST(
            request("POST", JSON.stringify({ title: "עותק" })),
            context(),
        );

        expect(response.status).toBe(200);
        expect(DbCurriculum.duplicateCurriculum).toHaveBeenCalledWith("c1", {
            title: "עותק",
        });
        expect((await response.json()).data).toEqual({ id: "c2" });
    });

    it("falls back to the source's values when no body is sent", async () => {
        vi.mocked(DbCurriculum.duplicateCurriculum).mockResolvedValueOnce(
            {} as never,
        );

        await DuplicateRoute.POST(request("POST"), context());

        expect(DbCurriculum.duplicateCurriculum).toHaveBeenCalledWith(
            "c1",
            {},
        );
    });

    it("rejects a malformed body and a missing curriculum id", async () => {
        expect(
            (await DuplicateRoute.POST(request("POST", "{nope"), context()))
                .status,
        ).toBe(400);
        expect(
            (await DuplicateRoute.POST(request("POST"), context(""))).status,
        ).toBe(400);
        expect(DbCurriculum.duplicateCurriculum).not.toHaveBeenCalled();
    });
});

describe("GET /api/gantt/curriculums/[id]/cut/preview", () => {
    it("returns the planner's dry-run occurrences", async () => {
        vi.mocked(previewCurriculumCut).mockResolvedValueOnce({
            events: [ { id: "e1" } ],
        } as never);

        const response = await PreviewRoute.GET(request("GET"), context());

        expect(response.status).toBe(200);
        expect(previewCurriculumCut).toHaveBeenCalledWith("c1");
        expect((await response.json()).data).toEqual({
            events: [ { id: "e1" } ],
        });
    });

    it("rejects a missing curriculum id without planning anything", async () => {
        const response = await PreviewRoute.GET(request("GET"), context(""));

        expect(response.status).toBe(400);
        expect(previewCurriculumCut).not.toHaveBeenCalled();
    });

    it("surfaces a planner failure as an error response", async () => {
        vi.mocked(previewCurriculumCut).mockRejectedValueOnce(
            new Error("unsatisfiable constraints"),
        );

        const response = await PreviewRoute.GET(request("GET"), context());

        expect(response.status).toBeGreaterThanOrEqual(400);
    });
});
