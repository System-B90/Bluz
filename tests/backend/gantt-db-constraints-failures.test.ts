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
    EntityType,
} from "@/api-server/gantt/db-constraints";
import { ganttConstraintsSchema } from "@/api-server/gantt/schema";

type ConstraintInsert = typeof ganttConstraintsSchema.$inferInsert;

/**
 * Thenable/chainable Drizzle query-builder stand-in: every property access
 * returns a function that re-returns the same chain, and awaiting the chain
 * at any point resolves/rejects to `result`.
 */
interface DrizzleChain<T> extends PromiseLike<T> {
    [key: string]: unknown;
}

function createChain<T>(result: T, shouldReject = false): DrizzleChain<T> {
    const methodCache = new Map<string | symbol, ReturnType<typeof vi.fn>>();
    const chain: DrizzleChain<T> = new Proxy(
        {},
        {
            get(_target, prop) {
                if (prop === "then") {
                    return (
                        onFulfilled: (value: T) => unknown,
                        onRejected: (reason: unknown) => unknown,
                    ) =>
                        (shouldReject
                            ? Promise.reject(result)
                            : Promise.resolve(result)
                        ).then(onFulfilled, onRejected);
                }
                if (prop === "catch") {
                    return (onRejected: (reason: unknown) => unknown) =>
                        (shouldReject
                            ? Promise.reject(result)
                            : Promise.resolve(result)
                        ).catch(onRejected);
                }
                if (!methodCache.has(prop)) {
                    methodCache.set(prop, vi.fn(() => chain));
                }
                return methodCache.get(prop);
            },
        },
    ) as DrizzleChain<T>;
    return chain;
}

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
                "invalid" as unknown as EntityType
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

            vi.mocked(postgresDb.query.ganttConstraintsSchema.findMany).mockResolvedValueOnce(
                []
            );

            await getConstraintsTargetingEntity("target-456", "module");

            expect(
                vi.mocked(postgresDb.query.ganttConstraintsSchema.findMany)
            ).toHaveBeenCalledTimes(2);
        });
    });

    describe("createConstraint", () => {
        it("throws error when insert fails", async () => {
            const dbError = new Error("Constraint validation failed");
            vi.mocked(postgresDb.insert).mockReturnValue(
                createChain(dbError, true)
            );

            await expect(
                createConstraint({
                    id: "c1",
                    ownerEventId: "e1",
                } as ConstraintInsert)
            ).rejects.toThrow("Constraint validation failed");
        });

        it("throws error when database is unavailable", async () => {
            const dbError = new Error("Database unavailable");
            vi.mocked(postgresDb.insert).mockReturnValue(
                createChain(dbError, true)
            );

            await expect(
                createConstraint({ id: "c1" } as ConstraintInsert)
            ).rejects.toThrow("Database unavailable");
        });

        it("returns created constraint record", async () => {
            const expectedConstraint = {
                id: "c1",
                ownerEventId: "e1",
                targetModuleId: "m1",
            };
            vi.mocked(postgresDb.insert).mockReturnValue(
                createChain([expectedConstraint])
            );

            const result = await createConstraint({ id: "c1" } as ConstraintInsert);

            expect(result).toEqual(expectedConstraint);
        });

        it("handles empty result from database", async () => {
            vi.mocked(postgresDb.insert).mockReturnValue(createChain([]));

            const result = await createConstraint({ id: "c1" } as ConstraintInsert);

            expect(result).toBeUndefined();
        });
    });

    describe("updateConstraint", () => {
        it("throws error when update fails", async () => {
            const dbError = new Error("Update constraint failed");
            vi.mocked(postgresDb.update).mockReturnValue(
                createChain(dbError, true)
            );

            await expect(
                updateConstraint("c1", { duration: 100 } as Partial<ConstraintInsert>)
            ).rejects.toThrow("Update constraint failed");
        });

        it("sets updated timestamp automatically", async () => {
            const chain = createChain([]);
            vi.mocked(postgresDb.update).mockReturnValue(chain);

            await updateConstraint("c1", { duration: 100 } as Partial<ConstraintInsert>);

            expect(chain.set).toHaveBeenCalledWith(
                expect.objectContaining({
                    updatedAt: expect.any(Date),
                    duration: 100,
                })
            );
        });

        it("handles partial updates", async () => {
            const chain = createChain([]);
            vi.mocked(postgresDb.update).mockReturnValue(chain);

            await updateConstraint("c1", { duration: 200 } as Partial<ConstraintInsert>);

            expect(chain.set).toHaveBeenCalled();
        });

        it("returns updated constraint records", async () => {
            const updatedConstraint = { id: "c1", duration: 200 };
            vi.mocked(postgresDb.update).mockReturnValue(
                createChain([updatedConstraint])
            );

            const result = await updateConstraint("c1", { duration: 200 } as Partial<ConstraintInsert>);

            expect(result).toEqual([updatedConstraint]);
        });
    });

    describe("deleteConstraint", () => {
        it("throws error when delete fails", async () => {
            const dbError = new Error("Delete constraint failed");
            vi.mocked(postgresDb.delete).mockReturnValue(
                createChain(dbError, true)
            );

            await expect(deleteConstraint("c1")).rejects.toThrow(
                "Delete constraint failed"
            );
        });

        it("returns deleted constraint record", async () => {
            const deletedConstraint = { id: "c1" };
            vi.mocked(postgresDb.delete).mockReturnValue(
                createChain([deletedConstraint])
            );

            const result = await deleteConstraint("c1");

            expect(result).toEqual([deletedConstraint]);
        });

        it("handles delete of non-existent constraint", async () => {
            vi.mocked(postgresDb.delete).mockReturnValue(createChain([]));

            const result = await deleteConstraint("non-existent");

            expect(result).toEqual([]);
        });
    });

    describe("getConstraintsForCurriculum", () => {
        it("throws error when the main query fails", async () => {
            const dbError = new Error("Query execution failed");
            vi.mocked(postgresDb.select).mockReturnValue(
                createChain(dbError, true)
            );

            await expect(
                getConstraintsForCurriculum("curr-1")
            ).rejects.toThrow("Query execution failed");
        });

        it("returns empty array when curriculum has no constraints", async () => {
            vi.mocked(postgresDb.select).mockReturnValue(createChain([]));

            const result = await getConstraintsForCurriculum("curr-1");

            expect(result).toEqual([]);
        });

        it("returns constraints matching the curriculum", async () => {
            const constraint = { id: "c1", ownerModuleId: "mod-1" };
            vi.mocked(postgresDb.select).mockReturnValue(
                createChain([constraint])
            );

            const result = await getConstraintsForCurriculum("curr-1");

            expect(result).toEqual([constraint]);
        });
    });

    describe("getConstraintsForSyllabus", () => {
        it("throws error when query fails", async () => {
            const dbError = new Error("Syllabus query failed");
            vi.mocked(postgresDb.select).mockReturnValue(
                createChain(dbError, true)
            );

            await expect(
                getConstraintsForSyllabus("syll-1")
            ).rejects.toThrow("Syllabus query failed");
        });

        it("returns empty array when syllabus has no constraints", async () => {
            vi.mocked(postgresDb.select).mockReturnValue(createChain([]));

            const result = await getConstraintsForSyllabus("syll-1");

            expect(result).toEqual([]);
        });
    });

    describe("getConstraintsForModule", () => {
        it("throws error when query fails", async () => {
            const dbError = new Error("Module query failed");
            vi.mocked(postgresDb.select).mockReturnValue(
                createChain(dbError, true)
            );

            await expect(
                getConstraintsForModule("mod-1")
            ).rejects.toThrow("Module query failed");
        });

        it("returns empty array when module has no constraints", async () => {
            vi.mocked(postgresDb.select).mockReturnValue(createChain([]));

            const result = await getConstraintsForModule("mod-1");

            expect(result).toEqual([]);
        });

        it("returns module-level and nested event constraints", async () => {
            const moduleConstraint = { id: "c1", ownerModuleId: "mod-1" };
            const eventConstraint = { id: "c2", ownerEventId: "e1" };

            vi.mocked(postgresDb.select).mockReturnValue(
                createChain([moduleConstraint, eventConstraint])
            );

            const result = await getConstraintsForModule("mod-1");

            expect(result).toHaveLength(2);
        });
    });

    describe("Edge Cases", () => {
        it("handles null constraint ID gracefully", async () => {
            vi.mocked(postgresDb.delete).mockReturnValue(createChain([]));

            const result = await deleteConstraint(null as unknown as string);

            expect(result).toEqual([]);
        });

        it("handles empty string IDs", async () => {
            vi.mocked(postgresDb.delete).mockReturnValue(createChain([]));

            const result = await deleteConstraint("");

            expect(result).toEqual([]);
        });
    });
});
