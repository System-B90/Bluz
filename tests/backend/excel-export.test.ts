import { describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";

// Mock gantt schema/db (self-contained to prevent hoisting issues)
vi.mock("@/api-server/gantt", () => {
    return {
        postgresDb: {
            select: () => ({
                from: () => ({
                    where: async () => [{ id: "m1", curriculumId: "c1", dayId: "d1", sortOrder: 1 }],
                }),
            }),
        },
    };
});

// Mock db-constraints
vi.mock("@/api-server/gantt/db-constraints", () => ({
    getConstraintsForCurriculum: vi.fn(),
}));

// Mock db-curriculum
vi.mock("@/api-server/gantt/db-curriculum", () => ({
    DbCurriculum: {
        getItem: vi.fn(),
    },
}));

import * as ExcelExportRoute from "@/app/api/gantt/curriculums/[id]/export/excel/route";
import { DbCurriculum } from "@/api-server/gantt/db-curriculum";
import { getConstraintsForCurriculum } from "@/api-server/gantt/db-constraints";

describe("Gantt Excel Export Route", () => {
    const routeContext = { params: Promise.resolve({ id: "c1" }) };

    it("GET - exports full curriculum to excel successfully", async () => {
        vi.mocked(DbCurriculum.getItem).mockResolvedValueOnce({
            id: "c1",
            title: "Curriculum Test",
            description: "Test description",
            startDate: "2026-06-18",
            c2s: [
                {
                    syllabus: {
                        id: "s1",
                        title: "Syllabus 1",
                        s2m: [
                            {
                                module: {
                                    id: "mod1",
                                    title: "Module 1",
                                    m2e: [
                                        {
                                            event: {
                                                id: "e1",
                                                title: "Event 1",
                                                minimumDuration: 120,
                                                cEC: [
                                                    {
                                                        curriculumId: "c1",
                                                        eventId: "e1",
                                                        allocatedDuration: 180,
                                                    },
                                                ],
                                            },
                                        },
                                    ],
                                },
                            },
                        ],
                    },
                },
            ],
            c2w: [
                {
                    week: {
                        id: "w1",
                        number: 1,
                        w2d: [
                            {
                                day: {
                                    id: "d1",
                                    dayIndex: 0,
                                    totalWorkingMinutes: 480,
                                },
                            },
                        ],
                    },
                },
            ],
        } as any);

        vi.mocked(getConstraintsForCurriculum).mockResolvedValueOnce([]);

        const request = new NextRequest("http://localhost/api/gantt/curriculums/c1/export/excel");
        const response = await ExcelExportRoute.GET(request, routeContext);

        expect(response.status).toBe(200);
        expect(response.headers.get("content-type")).toBe(
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );
        expect(response.headers.get("content-disposition")).toContain("filename*=UTF-8''bluz-gantt-Curriculum_Test.xlsx");
        
        const buffer = await response.arrayBuffer();
        expect(buffer.byteLength).toBeGreaterThan(0);
    });
});
