import { describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";
import { Workbook } from "@vendor/exceljs";

// Bypass requireStaffSession()'s getServerSession() call, which touches
// next/headers outside a request scope in vitest (#223).
vi.mock("next-auth", async () => {
    const { Clearance } = await import("@/api-shared/types/hive");
    return {
        default: vi.fn(() => vi.fn()),
        getServerSession: vi.fn(async () => ({
            user: {
                id: "test-user",
                display_name: "Test User",
                clearance: Clearance.Admin,
            },
        })),
    };
});

vi.mock("@/api-server/hive/sso", () => ({
    authOptions: {},
}));

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

// Hive is the only source of user names for the אחראי column (#466).
vi.mock("@/api-server/hive/session-client", () => ({
    createHiveClient: vi.fn(),
}));

import * as ExcelExportRoute from "@/app/api/gantt/curriculums/[id]/export/excel/route";
import { DbCurriculum } from "@/api-server/gantt/db-curriculum";
import { getConstraintsForCurriculum } from "@/api-server/gantt/db-constraints";
import { createHiveClient } from "@/api-server/hive/session-client";

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
                                                type: "הרצאה",
                                                minimumDuration: 120,
                                                roomRequirement: "בחוץ",
                                                recurrence: "weekly",
                                                isCritical: true,
                                                isPaWindow: false,
                                                orchestratorId: 42,
                                                systemRequirements: ["מקרן"],
                                                comment: "הערה",
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

        // Parse the workbook back to assert on the generated content.
        const wb = new Workbook();
        await wb.xlsx.load(buffer);

        const sheetNames = wb.worksheets.map((s) => s.name);
        expect(sheetNames).toEqual(["סקירה", "לוח זמנים", "פירוט סילבוסים"]);

        // Overview: start date, end date, and total working hours present.
        const overview = wb.getWorksheet("סקירה")!;
        const overviewFields: Array<string> = [];
        overview.eachRow((row) => overviewFields.push(String(row.getCell(1).value ?? "")));
        expect(overviewFields).toContain("תאריך התחלה");
        expect(overviewFields).toContain("תאריך סיום");
        expect(overviewFields).toContain("סך שעות עבודה");

        // Timeline: includes the week-name column header.
        const timeline = wb.getWorksheet("לוח זמנים")!;
        const timelineHeaders = (timeline.getRow(1).values as Array<unknown>).map((v) =>
            String(v ?? ""),
        );
        expect(timelineHeaders).toContain("שם השבוע");

        // Detail sheet: syllabus + module summary rows carry required-hour totals (3h).
        const detail = wb.getWorksheet("פירוט סילבוסים")!;
        const detailText: Array<Array<string>> = [];
        detail.eachRow((row) => {
            const cells: Array<string> = [];
            row.eachCell({ includeEmpty: true }, (cell) => cells.push(String(cell.value ?? "")));
            detailText.push(cells);
        });
        // Syllabus summary row: title in col 1, total required hours (3) in col 7.
        const syllabusRow = detailText.find((r) => r[0] === "Syllabus 1");
        expect(syllabusRow?.[6]).toBe("3");
        // Module summary row: title in col 2, total required hours (3) in col 7.
        const moduleRow = detailText.find((r) => r[1] === "Module 1");
        expect(moduleRow?.[6]).toBe("3");
        // Event row: name in col 3, with the field columns populated.
        const eventRow = detailText.find((r) => r[2] === "Event 1");
        expect(eventRow?.[3]).toBe("הרצאה"); // type
        expect(eventRow?.[6]).toBe("3"); // required hours (allocated 180m)
    });
});

describe("Gantt Excel Export - orchestrator names (#466)", () => {
    const routeContext = { params: Promise.resolve({ id: "c1" }) };

    function mockCurriculum() {
        vi.mocked(DbCurriculum.getItem).mockResolvedValueOnce({
            id: "c1",
            title: "Curriculum Test",
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
                                                type: "הרצאה",
                                                minimumDuration: 120,
                                                orchestratorId: 42,
                                                recurrence: "weekly",
                                                systemRequirements: [],
                                                cEC: [],
                                            },
                                        },
                                    ],
                                },
                            },
                        ],
                    },
                },
            ],
            c2w: [],
        } as any);
        vi.mocked(getConstraintsForCurriculum).mockResolvedValueOnce([]);
    }

    async function exportOrchestratorCell(): Promise<string> {
        const request = new NextRequest(
            "http://localhost/api/gantt/curriculums/c1/export/excel",
        );
        const response = await ExcelExportRoute.GET(request, routeContext);
        expect(response.status).toBe(200);

        const wb = new Workbook();
        await wb.xlsx.load(await response.arrayBuffer());
        const detail = wb.getWorksheet("פירוט סילבוסים")!;

        let cell = "";
        detail.eachRow((row) => {
            if (String(row.getCell(3).value ?? "") === "Event 1") {
                cell = String(row.getCell(8).value ?? "");
            }
        });
        return cell;
    }

    it("resolves the orchestrator id to a Hive display name", async () => {
        mockCurriculum();
        vi.mocked(createHiveClient).mockResolvedValueOnce({
            getUsers: async () => [
                { id: 42, display_name: "רס\"ן ישראלה ישראלי" },
                { id: 7, display_name: "Someone Else" },
            ],
        } as any);

        expect(await exportOrchestratorCell()).toBe("רס\"ן ישראלה ישראלי");
    });

    it("still exports, falling back to the id, when Hive is unreachable", async () => {
        mockCurriculum();
        vi.mocked(createHiveClient).mockRejectedValueOnce(
            new Error("hive is down"),
        );

        // The export must not fail just because names could not be resolved.
        expect(await exportOrchestratorCell()).toBe("42");
    });

    it("falls back to the id for a user Hive does not know", async () => {
        mockCurriculum();
        vi.mocked(createHiveClient).mockResolvedValueOnce({
            getUsers: async () => [{ id: 7, display_name: "Someone Else" }],
        } as any);

        expect(await exportOrchestratorCell()).toBe("42");
    });
});
