import { describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";

// The routes exercised below are staff-gated. Bypass requireStaffSession()'s
// getServerSession() call, which touches next/headers outside a request scope
// in vitest — same shim as base-gantt.test.ts (#223).
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

/** Minimal stand-in for the Drizzle transaction object passed into `postgresDb.transaction(cb)`. */
interface MockTx {
    insert: () => MockTx;
    values: () => MockTx;
    returning: () => Array<{
        id: string;
        title: string;
        createdAt: Date;
        updatedAt: Date;
    }>;
}

// Mock gantt schema/db (self-contained to prevent hoisting issues)
vi.mock("@/api-server/gantt", () => {
    return {
        postgresDb: {
            select: () => ({
                from: () => ({
                    where: async () => [{ id: "m1", curriculumId: "c1" }],
                }),
            }),
            transaction: async (cb: (tx: MockTx) => unknown) => {
                const mockTx: MockTx = {
                    insert: () => mockTx,
                    values: () => mockTx,
                    returning: () => [{ id: "new-c-id", title: "Imported Curriculum (מיובא)", createdAt: new Date(), updatedAt: new Date() }],
                };
                return await cb(mockTx);
            },
        },
    };
});

// Mock db-constraints
vi.mock("@/api-server/gantt/db-constraints", () => ({
    getConstraintsForCurriculum: vi.fn(),
    getConstraintsForModule: vi.fn(),
    getConstraintsForSyllabus: vi.fn(),
    createConstraint: vi.fn(),
    updateConstraint: vi.fn(),
    deleteConstraint: vi.fn(),
}));

// Mock db-mappings
vi.mock("@/api-server/gantt/db-mappings", () => ({
    getModuleDayMappingsForCurriculum: vi.fn(),
    createCurriculumModuleDayMapping: vi.fn(),
    updateCurriculumModuleDayMapping: vi.fn(),
    deleteCurriculumModuleDayMapping: vi.fn(),
}));

// Mock db-curriculum
vi.mock("@/api-server/gantt/db-curriculum", () => ({
    DbCurriculum: {
        getItem: vi.fn(),
    },
}));

import * as ConstraintsRoute from "@/app/api/gantt/curriculums/[id]/constraints/route";
import * as MappingsRoute from "@/app/api/gantt/curriculums/[id]/mappings/route";
import * as ExportRoute from "@/app/api/gantt/curriculums/[id]/export/route";
import * as ImportRoute from "@/app/api/gantt/curriculums/import/route";

import {
    getConstraintsForCurriculum,
    getConstraintsForModule,
    createConstraint,
    updateConstraint,
    deleteConstraint,
} from "@/api-server/gantt/db-constraints";
import {
    getModuleDayMappingsForCurriculum,
    createCurriculumModuleDayMapping,
    updateCurriculumModuleDayMapping,
    deleteCurriculumModuleDayMapping,
} from "@/api-server/gantt/db-mappings";
import { DbCurriculum } from "@/api-server/gantt/db-curriculum";

describe("Gantt Constraints API Route", () => {
    const routeContext = { params: Promise.resolve({ id: "c1" }) };

    it("GET - constraints for curriculum", async () => {
        vi.mocked(getConstraintsForCurriculum).mockResolvedValueOnce([
            { id: "con1", type: "TEMPORAL" } as Awaited<ReturnType<typeof getConstraintsForCurriculum>>[number],
        ]);
        const request = new NextRequest("http://localhost/api/gantt/curriculums/c1/constraints");
        const response = await ConstraintsRoute.GET(request, routeContext);
        const data = await response.json();
        expect(response.status).toBe(200);
        expect(data.data).toEqual([{ id: "con1", type: "TEMPORAL" }]);
    });

    it("GET - constraints for module", async () => {
        vi.mocked(getConstraintsForModule).mockResolvedValueOnce([
            { id: "con2", type: "RELATIONAL" } as Awaited<ReturnType<typeof getConstraintsForModule>>[number],
        ]);
        const request = new NextRequest("http://localhost/api/gantt/curriculums/c1/constraints?moduleId=m1");
        const response = await ConstraintsRoute.GET(request, routeContext);
        const data = await response.json();
        expect(response.status).toBe(200);
        expect(data.data).toEqual([{ id: "con2", type: "RELATIONAL" }]);
    });

    it("POST - creates a constraint", async () => {
        const payload = { id: "con3", type: "TEMPORAL", ownerType: "event", ownerEventId: "e1" };
        vi.mocked(createConstraint).mockResolvedValueOnce(
            { id: "con3" } as Awaited<ReturnType<typeof createConstraint>>,
        );
        const request = new NextRequest("http://localhost/api/gantt/curriculums/c1/constraints", {
            method: "POST",
            body: JSON.stringify(payload),
        });
        const response = await ConstraintsRoute.POST(request, routeContext);
        const data = await response.json();
        expect(response.status).toBe(200);
        expect(data.data).toEqual({ id: "con3" });
    });

    it("PATCH - updates a constraint", async () => {
        const payload = { id: "con3", relation: "FS" };
        vi.mocked(updateConstraint).mockResolvedValueOnce([
            { id: "con3", relation: "FS" } as Awaited<ReturnType<typeof updateConstraint>>[number],
        ]);
        const request = new NextRequest("http://localhost/api/gantt/curriculums/c1/constraints", {
            method: "PATCH",
            body: JSON.stringify(payload),
        });
        const response = await ConstraintsRoute.PATCH(request, routeContext);
        const data = await response.json();
        expect(response.status).toBe(200);
        expect(data.data).toEqual({ id: "con3", relation: "FS" });
    });

    it("DELETE - removes a constraint", async () => {
        vi.mocked(deleteConstraint).mockResolvedValueOnce(
            { id: "con3" } as unknown as Awaited<ReturnType<typeof deleteConstraint>>,
        );
        const request = new NextRequest("http://localhost/api/gantt/curriculums/c1/constraints", {
            method: "DELETE",
            body: JSON.stringify({ id: "con3" }),
        });
        const response = await ConstraintsRoute.DELETE(request, routeContext);
        const data = await response.json();
        expect(response.status).toBe(200);
        expect(data.data).toEqual({ id: "con3" });
    });
});

describe("Gantt Mappings API Route", () => {
    const routeContext = { params: Promise.resolve({ id: "c1" }) };

    it("GET - mappings for curriculum", async () => {
        vi.mocked(getModuleDayMappingsForCurriculum).mockResolvedValueOnce([
            { id: "map1" } as unknown as Awaited<ReturnType<typeof getModuleDayMappingsForCurriculum>>[number],
        ]);
        const request = new NextRequest("http://localhost/api/gantt/curriculums/c1/mappings");
        const response = await MappingsRoute.GET(request, routeContext);
        const data = await response.json();
        expect(response.status).toBe(200);
        expect(data.data).toEqual([{ id: "map1" }]);
    });

    it("POST - creates a mapping", async () => {
        const payload = { moduleId: "m1", dayId: "d1" };
        vi.mocked(createCurriculumModuleDayMapping).mockResolvedValueOnce(
            { id: "map2" } as unknown as Awaited<ReturnType<typeof createCurriculumModuleDayMapping>>,
        );
        const request = new NextRequest("http://localhost/api/gantt/curriculums/c1/mappings", {
            method: "POST",
            body: JSON.stringify(payload),
        });
        const response = await MappingsRoute.POST(request, routeContext);
        const data = await response.json();
        expect(response.status).toBe(200);
        expect(data.data).toEqual({ id: "map2" });
    });

    it("PATCH - updates a mapping", async () => {
        const payload = { moduleId: "m1", oldMapping: { dayId: "d1" }, newValues: { dayId: "d2" } };
        vi.mocked(updateCurriculumModuleDayMapping).mockResolvedValueOnce(
            { id: "map2" } as unknown as Awaited<ReturnType<typeof updateCurriculumModuleDayMapping>>,
        );
        const request = new NextRequest("http://localhost/api/gantt/curriculums/c1/mappings", {
            method: "PATCH",
            body: JSON.stringify(payload),
        });
        const response = await MappingsRoute.PATCH(request, routeContext);
        const data = await response.json();
        expect(response.status).toBe(200);
        expect(data.data).toEqual({ id: "map2" });
    });

    it("DELETE - removes a mapping", async () => {
        vi.mocked(deleteCurriculumModuleDayMapping).mockResolvedValueOnce(
            { id: "map2" } as unknown as Awaited<ReturnType<typeof deleteCurriculumModuleDayMapping>>,
        );
        const request = new NextRequest("http://localhost/api/gantt/curriculums/c1/mappings", {
            method: "DELETE",
            body: JSON.stringify({ moduleId: "m1", dayId: "d1" }),
        });
        const response = await MappingsRoute.DELETE(request, routeContext);
        const data = await response.json();
        expect(response.status).toBe(200);
        expect(data.data).toEqual({ id: "map2" });
    });
});

describe("Gantt Export Route", () => {
    const routeContext = { params: Promise.resolve({ id: "c1" }) };

    it("GET - exports full curriculum", async () => {
        vi.mocked(DbCurriculum.getItem).mockResolvedValueOnce({ id: "c1", title: "Curriculum 1" });
        vi.mocked(getConstraintsForCurriculum).mockResolvedValueOnce([
            { id: "con1" } as Awaited<ReturnType<typeof getConstraintsForCurriculum>>[number],
        ]);

        const request = new NextRequest("http://localhost/api/gantt/curriculums/c1/export");
        const response = await ExportRoute.GET(request, routeContext);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.data.curriculum).toEqual({ id: "c1", title: "Curriculum 1" });
        expect(data.data.mappings).toEqual([{ id: "m1", curriculumId: "c1" }]);
        expect(data.data.constraints).toEqual([{ id: "con1" }]);
    });
});

describe("Gantt Import Route", () => {
    it("POST - imports curriculum successfully", async () => {
        const payload = {
            curriculum: {
                title: "Curriculum Test",
                c2w: [],
                c2s: [],
            },
            mappings: [],
            constraints: [],
        };
        const request = new NextRequest("http://localhost/api/gantt/curriculums/import", {
            method: "POST",
            body: JSON.stringify(payload),
        });
        const response = await ImportRoute.POST(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.data.id).toBe("new-c-id");
    });
});
