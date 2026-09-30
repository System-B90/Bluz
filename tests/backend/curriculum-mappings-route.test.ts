import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/api-server/gantt/db-mappings", () => ({
    createCurriculumModuleDayMapping: vi.fn(),
    deleteCurriculumModuleDayMapping: vi.fn(),
    getModuleDayMappingsForCurriculum: vi.fn(),
    updateCurriculumModuleDayMapping: vi.fn(async () => []),
}));
vi.mock("@/api-server/session-user", () => ({
    requireStaffSession: vi.fn(async () => undefined),
    getSessionUser: vi.fn(async () => ({ id: "u1" })),
}));

import { updateCurriculumModuleDayMapping } from "@/api-server/gantt/db-mappings";
import * as MappingsRoute from "@/app/api/gantt/curriculums/[id]/mappings/route";

const context = { params: Promise.resolve({ id: "c1" }) };

function patch(newValues: unknown) {
    return new NextRequest("http://localhost/api/gantt/curriculums/c1/mappings", {
        method: "PATCH",
        body: JSON.stringify({
            moduleId: "m1",
            eventId: "e1",
            oldMapping: { dayId: "d1" },
            newValues,
        }),
    });
}

beforeEach(() => vi.clearAllMocks());

describe("PATCH /api/gantt/curriculums/[id]/mappings weekSplitMinutes (#768)", () => {
    it("forwards a valid week split", async () => {
        const response = await MappingsRoute.PATCH(
            patch({ weekSplitMinutes: [ 180, 240 ] }),
            context,
        );

        expect(response.status).toBe(200);
        expect(updateCurriculumModuleDayMapping).toHaveBeenCalledWith(
            "c1",
            "m1",
            "e1",
            { dayId: "d1" },
            { weekSplitMinutes: [ 180, 240 ] },
        );
    });

    it("accepts an empty split — that is how a split is cleared", async () => {
        const response = await MappingsRoute.PATCH(
            patch({ weekSplitMinutes: [] }),
            context,
        );

        expect(response.status).toBe(200);
    });

    it("rejects non-positive, fractional or non-array splits", async () => {
        for (const weekSplitMinutes of [ [ 0, 60 ], [ -1 ], [ 1.5 ], "60" ]) {
            const response = await MappingsRoute.PATCH(
                patch({ weekSplitMinutes }),
                context,
            );
            expect(response.status).toBe(400);
        }
        expect(updateCurriculumModuleDayMapping).not.toHaveBeenCalled();
    });

    it("regression: a plain move still goes through", async () => {
        const response = await MappingsRoute.PATCH(patch({ dayId: "d2" }), context);

        expect(response.status).toBe(200);
        expect(updateCurriculumModuleDayMapping).toHaveBeenCalledWith(
            "c1",
            "m1",
            "e1",
            { dayId: "d1" },
            { dayId: "d2" },
        );
    });
});
