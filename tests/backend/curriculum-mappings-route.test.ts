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

describe("PATCH /api/gantt/curriculums/[id]/mappings allottedMinutes", () => {
    it("forwards valid allotted minutes", async () => {
        const response = await MappingsRoute.PATCH(
            patch({ allottedMinutes: 180 }),
            context,
        );

        expect(response.status).toBe(200);
        expect(updateCurriculumModuleDayMapping).toHaveBeenCalledWith(
            "c1",
            "m1",
            "e1",
            { dayId: "d1" },
            { allottedMinutes: 180 },
        );
    });

    it("accepts 0 minutes", async () => {
        const response = await MappingsRoute.PATCH(
            patch({ allottedMinutes: 0 }),
            context,
        );

        expect(response.status).toBe(200);
    });

    it("rejects negative, fractional or non-number minutes", async () => {
        for (const allottedMinutes of [ -1, 1.5, "60", null, [ 60 ] ]) {
            const response = await MappingsRoute.PATCH(
                patch({ allottedMinutes }),
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
