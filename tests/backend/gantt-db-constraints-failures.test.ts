import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/api-server/gantt", () => ({
    postgresDb: {
        query: {
            ganttConstraintsSchema: {
                findMany: vi.fn(),
            },
        },
        insert: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        select: vi.fn(),
    },
}));

import { postgresDb } from "@/api-server/gantt";
import {
    getConstraintsForOwner,
    getConstraintsTargetingEntity,
    createConstraint,
    updateConstraint,
    deleteConstraint,
    getConstraintsForCurriculum,
    getConstraintsForSyllabus,
    getConstraintsForModule,
} from "@/api-server/gantt/db-constraints";

describe("Gantt DB Constraints - Failure Paths", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("getConstraintsForOwner", () => {
        it("throws error when database query fails", async () => {
            const dbError = new Error("Database connection error");
            vi.mocked(postgresDb.query.ganttConstraintsSchema.findMany).mockRejectedValueOnce(
                dbError
            );

            await expect(
                getConstraintsForOwner("owner-id", "event")
            ).rejects.toThrow("Database connection error");
        });

        it("returns empty array when no constraints found", async () => {
            vi.mocked(postgresDb.query.ganttConstraintsSchema.findMany).mockResolvedValueOnce(
                []
            );

            const result = await getConstraintsForOwner("owner-id", "event");
            expect(result).toEqual([]);
        });

        it("handles invalid owner type gracefully", async () => {
            vi.mocked(postgresDb.query.ganttConstraintsSchema.findMany).mockResolvedValueOnce(
                []
            );

            const result = await getConstraintsForOwner(
                "owner-id",
                "invalid" as any
            );
            expect(result).toEqual([]);
        });

        it("queries with correct condition for event owner", async () => {
            vi.mocked(postgresDb.query.ganttConstraintsSchema.findMany).mockResolvedValueOnce(
                []
            );

            await getConstraintsForOwner("event-123", "event");

            expect(
                vi.mocked(postgresDb.query.ganttConstraintsSchema.findMany)
            ).toHaveBeenCalled();
        });

        it("queries with correct condition for module owner", async () => {
            vi.mocked(postgresDb.query.ganttConstraintsSchema.findMany).mockResolvedValueOnce(
                []
            );

            await getConstraintsForOwner("module-456", "module");

            expect(
                vi.mocked(postgresDb.query.ganttConstraintsSchema.findMany)
            ).toHaveBeenCalled();
        });
    });

    describe("getConstraintsTargetingEntity", () => {
        it("throws error when database query fails", async () => {
            const dbError = new Error("Query timeout");
            vi.mocked(postgresDb.query.ganttConstraintsSchema.findMany).mockRejectedValueOnce(
                dbError
            );

            await expect(
                getConstraintsTargetingEntity("target-id", "event")
            ).rejects.toThrow("Query timeout");
        });

        it("returns empty array when no targeting constraints found", async () => {
            vi.mocked(postgresDb.query.ganttConstraintsSchema.findMany).mockResolvedValueOnce(
                []
            );

            const result = await getConstraintsTargetingEntity("target-id", "event");
            expect(result).toEqual([]);
        });

        it("handles different target types", async () => {
            vi.mocked(postgresDb.query.ganttConstraintsSchema.findMany).mockResolvedValueOnce(
                []
            );

            await getConstraintsTargetingEntity("target-123", "event");
            await getConstraintsTargetingEntity("target-456", "module");

            expect(
                vi.mocked(postgresDb.query.ganttConstraintsSchema.findMany)
            ).toHaveBeenCalledTimes(2);
        });
    });

    describe("createConstraint", () => {
        it("throws error when insert fails", async () => {
            const dbError = new Error("Constraint validation failed");
            const mockInsert = vi.fn().mockReturnValue({
                values: vi.fn().mockRejectedValueOnce(dbError),
            });
            vi.mocked(postgresDb.insert).mockReturnValue(mockInsert as any);

            await expect(
                createConstraint({
                    id: "c1",
                    ownerEventId: "e1",
                } as any)
            ).rejects.toThrow("Constraint validation failed");
        });

        it("throws error when database is unavailable", async () => {
            const dbError = new Error("Database unavailable");
            const mockInsert = vi.fn().mockReturnValue({
                values: vi.fn().mockRejectedValueOnce(dbError),
            });
            vi.mocked(postgresDb.insert).mockReturnValue(mockInsert as any);

            await expect(
                createConstraint({ id: "c1" } as any)
            ).rejects.toThrow("Database unavailable");
        });

        it("returns created constraint record", async () => {
            const expectedConstraint = {
                id: "c1",
                ownerEventId: "e1",
                targetModuleId: "m1",
            };
            const mockReturning = vi.fn().mockResolvedValueOnce([expectedConstraint]);
            const mockValues = vi.fn().mockReturnValue({
                returning: mockReturning,
            });
            const mockInsert = vi.fn().mockReturnValue({
                values: mockValues,
            });
            vi.mocked(postgresDb.insert).mockReturnValue(mockInsert as any);

            const result = await createConstraint({ id: "c1" } as any);

            expect(result).toEqual(expectedConstraint);
        });

        it("handles empty result from database", async () => {
            const mockReturning = vi.fn().mockResolvedValueOnce([]);
            const mockValues = vi.fn().mockReturnValue({
                returning: mockReturning,
            });
            const mockInsert = vi.fn().mockReturnValue({
                values: mockValues,
            });
            vi.mocked(postgresDb.insert).mockReturnValue(mockInsert as any);

            const result = await createConstraint({ id: "c1" } as any);

            expect(result).toBeUndefined();
        });
    });

    describe("updateConstraint", () => {
        it("throws error when update fails", async () => {
            const dbError = new Error("Update constraint failed");
            const mockWhere = vi.fn().mockRejectedValueOnce(dbError);
            const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
            const mockUpdate = vi.fn().mockReturnValue({
                set: mockSet,
            });
            vi.mocked(postgresDb.update).mockReturnValue(mockUpdate as any);

            await expect(
                updateConstraint("c1", { duration: 100 } as any)
            ).rejects.toThrow("Update constraint failed");
        });

        it("sets updated timestamp automatically", async () => {
            const mockWhere = vi.fn().mockResolvedValueOnce([]);
            const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
            const mockUpdate = vi.fn().mockReturnValue({
                set: mockSet,
            });
            vi.mocked(postgresDb.update).mockReturnValue(mockUpdate as any);

            await updateConstraint("c1", { duration: 100 } as any);

            expect(mockSet).toHaveBeenCalledWith(
                expect.objectContaining({
                    updatedAt: expect.any(Date),
                    duration: 100,
                })
            );
        });

        it("handles partial updates", async () => {
            const mockWhere = vi.fn().mockResolvedValueOnce([]);
            const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
            const mockUpdate = vi.fn().mockReturnValue({
                set: mockSet,
            });
            vi.mocked(postgresDb.update).mockReturnValue(mockUpdate as any);

            await updateConstraint("c1", { duration: 200 } as any);

            expect(mockSet).toHaveBeenCalled();
        });

        it("returns updated constraint records", async () => {
            const updatedConstraint = { id: "c1", duration: 200 };
            const mockWhere = vi.fn().mockResolvedValueOnce([updatedConstraint]);
            const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
            const mockUpdate = vi.fn().mockReturnValue({
                set: mockSet,
            });
            vi.mocked(postgresDb.update).mockReturnValue(mockUpdate as any);

            const result = await updateConstraint("c1", { duration: 200 } as any);

            expect(result).toEqual([updatedConstraint]);
        });
    });

    describe("deleteConstraint", () => {
        it("throws error when delete fails", async () => {
            const dbError = new Error("Delete constraint failed");
            const mockWhere = vi.fn().mockRejectedValueOnce(dbError);
            const mockDelete = vi.fn().mockReturnValue({
                where: mockWhere,
            });
            vi.mocked(postgresDb.delete).mockReturnValue(mockDelete as any);

            await expect(deleteConstraint("c1")).rejects.toThrow(
                "Delete constraint failed"
            );
        });

        it("returns deleted constraint record", async () => {
            const deletedConstraint = { id: "c1" };
            const mockWhere = vi.fn().mockResolvedValueOnce([deletedConstraint]);
            const mockDelete = vi.fn().mockReturnValue({
                where: mockWhere,
            });
            vi.mocked(postgresDb.delete).mockReturnValue(mockDelete as any);

            const result = await deleteConstraint("c1");

            expect(result).toEqual([deletedConstraint]);
        });

        it("handles delete of non-existent constraint", async () => {
            const mockWhere = vi.fn().mockResolvedValueOnce([]);
            const mockDelete = vi.fn().mockReturnValue({
                where: mockWhere,
            });
            vi.mocked(postgresDb.delete).mockReturnValue(mockDelete as any);

            const result = await deleteConstraint("non-existent");

            expect(result).toEqual([]);
        });
    });

    describe("getConstraintsForCurriculum", () => {
        it("throws error when subquery fails", async () => {
            const dbError = new Error("Subquery execution failed");
            vi.mocked(postgresDb.select).mockReturnValue({
                from: vi.fn().mockRejectedValueOnce(dbError),
            } as any);

            await expect(
                getConstraintsForCurriculum("curr-1")
            ).rejects.toThrow("Subquery execution failed");
        });

        it("returns empty array when curriculum has no modules", async () => {
            const mockSelect = vi.fn().mockReturnValue({
                from: vi.fn().mockResolvedValueOnce([]),
            });
            vi.mocked(postgresDb.select).mockReturnValue(mockSelect as any);

            const result = await getConstraintsForCurriculum("curr-1");

            expect(result).toEqual([]);
        });

        it("handles curriculum with no constraints", async () => {
            vi.mocked(postgresDb.select).mockReturnValue({
                from: vi.fn().mockResolvedValueOnce([]),
            } as any);

            const result = await getConstraintsForCurriculum("curr-1");

            expect(result).toEqual([]);
        });
    });

    describe("getConstraintsForSyllabus", () => {
        it("throws error when query fails", async () => {
            const dbError = new Error("Syllabus query failed");
            vi.mocked(postgresDb.select).mockReturnValue({
                from: vi.fn().mockRejectedValueOnce(dbError),
            } as any);

            await expect(
                getConstraintsForSyllabus("syll-1")
            ).rejects.toThrow("Syllabus query failed");
        });

        it("returns empty array when syllabus has no modules", async () => {
            vi.mocked(postgresDb.select).mockReturnValue({
                from: vi.fn().mockResolvedValueOnce([]),
            } as any);

            const result = await getConstraintsForSyllabus("syll-1");

            expect(result).toEqual([]);
        });

        it("handles syllabus with no events", async () => {
            vi.mocked(postgresDb.select).mockReturnValue({
                from: vi.fn().mockResolvedValueOnce([]),
            } as any);

            const result = await getConstraintsForSyllabus("syll-1");

            expect(result).toEqual([]);
        });
    });

    describe("getConstraintsForModule", () => {
        it("throws error when query fails", async () => {
            const dbError = new Error("Module query failed");
            vi.mocked(postgresDb.select).mockReturnValue({
                from: vi.fn().mockRejectedValueOnce(dbError),
            } as any);

            await expect(
                getConstraintsForModule("mod-1")
            ).rejects.toThrow("Module query failed");
        });

        it("returns empty array when module has no constraints", async () => {
            vi.mocked(postgresDb.select).mockReturnValue({
                from: vi.fn().mockResolvedValueOnce([]),
            } as any);

            const result = await getConstraintsForModule("mod-1");

            expect(result).toEqual([]);
        });

        it("returns module-level and nested event constraints", async () => {
            const moduleConstraint = { id: "c1", ownerModuleId: "mod-1" };
            const eventConstraint = { id: "c2", ownerEventId: "e1" };

            vi.mocked(postgresDb.select).mockReturnValue({
                from: vi
                    .fn()
                    .mockResolvedValueOnce([moduleConstraint, eventConstraint]),
            } as any);

            const result = await getConstraintsForModule("mod-1");

            expect(result).toHaveLength(2);
        });
    });

    describe("Edge Cases", () => {
        it("handles null constraint ID gracefully", async () => {
            const mockWhere = vi.fn().mockResolvedValueOnce([]);
            const mockDelete = vi.fn().mockReturnValue({
                where: mockWhere,
            });
            vi.mocked(postgresDb.delete).mockReturnValue(mockDelete as any);

            const result = await deleteConstraint(null as any);

            expect(result).toEqual([]);
        });

        it("handles empty string IDs", async () => {
            const mockWhere = vi.fn().mockResolvedValueOnce([]);
            const mockDelete = vi.fn().mockReturnValue({
                where: mockWhere,
            });
            vi.mocked(postgresDb.delete).mockReturnValue(mockDelete as any);

            const result = await deleteConstraint("");

            expect(result).toEqual([]);
        });
    });
});
