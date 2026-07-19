import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/api-server/gantt", () => ({
    postgresDb: {
        query: {
            ganttEventsSchema: {
                findFirst: vi.fn(),
            },
            ganttCurriculumEventConfigurationsSchema: {
                findFirst: vi.fn(),
            },
        },
        insert: vi.fn(),
        delete: vi.fn(),
    },
}));

import { postgresDb } from "@/api-server/gantt";
import { DbModuleEvent } from "@/api-server/gantt/db-module-event";
import { ClientApiError } from "@/api-shared/errors";

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

type DbErrorCause = {
    code: string;
    name: string;
    severity?: string;
    detail?: string;
};
type DbError = Error & { cause: DbErrorCause };

describe("Gantt DB Module Event - Failure Paths", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("getFullModuleEvent", () => {
        it("throws ClientApiError when event not found", async () => {
            vi.mocked(postgresDb.query.ganttEventsSchema.findFirst).mockResolvedValueOnce(null);

            await expect(DbModuleEvent.getItem("event-not-found")).rejects.toThrow(
                ClientApiError
            );
        });

        it("throws error with Hebrew message when event not found", async () => {
            vi.mocked(postgresDb.query.ganttEventsSchema.findFirst).mockResolvedValueOnce(null);

            await expect(DbModuleEvent.getItem("e123")).rejects.toThrow(/מופע/);
        });

        it("throws error when database query fails", async () => {
            const dbError = new Error("Database connection error");
            vi.mocked(postgresDb.query.ganttEventsSchema.findFirst).mockRejectedValueOnce(
                dbError
            );

            await expect(DbModuleEvent.getItem("e123")).rejects.toThrow(
                "Database connection error"
            );
        });

        it("returns event with related configurations", async () => {
            const mockEvent = {
                id: "e1",
                title: "Event 1",
                cEC: [
                    { eventId: "e1", curriculumId: "curr1", allocatedDuration: 100 },
                ],
            };

            vi.mocked(postgresDb.query.ganttEventsSchema.findFirst).mockResolvedValueOnce(
                mockEvent
            );

            const result = await DbModuleEvent.getItem("e1");

            expect(result.id).toBe("e1");
            expect(result.cEC).toBeDefined();
        });

        it("throws ClientApiError for an empty event ID (not found)", async () => {
            vi.mocked(postgresDb.query.ganttEventsSchema.findFirst).mockResolvedValueOnce(null);

            await expect(DbModuleEvent.getItem("")).rejects.toThrow(ClientApiError);
        });
    });

    describe("addEventToModule", () => {
        it("throws error when event already linked to module", async () => {
            const uniqueViolationError = new Error("Unique constraint violation") as DbError;
            uniqueViolationError.cause = {
                code: "23505", // UNIQUE_VIOLATION
                name: "QueryFailedError",
                severity: "ERROR",
                detail: "duplicate key",
            };

            vi.mocked(postgresDb.insert).mockReturnValue(
                createChain(uniqueViolationError, true)
            );

            await expect(
                DbModuleEvent.linkItem("mod1", "e1")
            ).rejects.toThrow(/כבר משויך/);
        });

        it("throws error when module or event does not exist", async () => {
            const fkViolationError = new Error("Foreign key constraint violation") as DbError;
            fkViolationError.cause = {
                code: "23503", // FOREIGN_KEY_VIOLATION
                name: "QueryFailedError",
                severity: "ERROR",
                detail: "foreign key constraint failed",
            };

            vi.mocked(postgresDb.insert).mockReturnValue(
                createChain(fkViolationError, true)
            );

            await expect(
                DbModuleEvent.linkItem("non-existent-mod", "non-existent-event")
            ).rejects.toThrow(/מערך או אירוע לא קיימים/);
        });

        it("throws generic error for unknown database error", async () => {
            const unknownError = new Error("Unknown database error") as DbError;
            unknownError.cause = {
                code: "99999",
                name: "QueryFailedError",
            };

            vi.mocked(postgresDb.insert).mockReturnValue(
                createChain(unknownError, true)
            );

            await expect(
                DbModuleEvent.linkItem("mod1", "e1")
            ).rejects.toThrow(ClientApiError);
        });

        it("retrieves event after successful link", async () => {
            const mockEvent = { id: "e1", title: "Event" };
            vi.mocked(postgresDb.insert).mockReturnValue(
                createChain({ acknowledged: true })
            );
            vi.mocked(postgresDb.query.ganttEventsSchema.findFirst).mockResolvedValueOnce(
                mockEvent
            );

            const result = await DbModuleEvent.linkItem("mod1", "e1");

            expect(result.id).toBe("e1");
        });

        it("wraps error when event fetch fails after linking", async () => {
            vi.mocked(postgresDb.insert).mockReturnValue(
                createChain({ acknowledged: true })
            );
            const fetchError = new Error("Event fetch failed");
            vi.mocked(postgresDb.query.ganttEventsSchema.findFirst).mockRejectedValueOnce(
                fetchError
            );

            // The post-insert fetch happens inside the same try/catch as the
            // insert, so its error is swallowed into the generic link-failure message.
            await expect(
                DbModuleEvent.linkItem("mod1", "e1")
            ).rejects.toThrow(/Failed to add event/);
        });
    });

    describe("removeEventFromModule", () => {
        it("throws error when mapping does not exist", async () => {
            vi.mocked(postgresDb.delete).mockReturnValue(createChain([]));

            await expect(
                DbModuleEvent.unlinkItem("mod1", "non-existent-event")
            ).rejects.toThrow(/No mapping found/);
        });

        it("throws error when database delete fails", async () => {
            const dbError = new Error("Delete operation failed");
            vi.mocked(postgresDb.delete).mockReturnValue(createChain(dbError, true));

            await expect(
                DbModuleEvent.unlinkItem("mod1", "e1")
            ).rejects.toThrow("Delete operation failed");
        });

        it("successfully removes event-module mapping", async () => {
            vi.mocked(postgresDb.delete).mockReturnValue(
                createChain([{ deletedModuleId: "mod1" }])
            );

            await expect(
                DbModuleEvent.unlinkItem("mod1", "e1")
            ).resolves.toBeUndefined();
        });
    });

    describe("getAllocatedTime", () => {
        it("returns 0 when no allocation found", async () => {
            vi.mocked(
                postgresDb.query.ganttCurriculumEventConfigurationsSchema.findFirst
            ).mockResolvedValueOnce(null);

            const result = await DbModuleEvent.getAllocatedTime("e1", "curr1");

            expect(result).toBe(0);
        });

        it("throws error when database query fails", async () => {
            const dbError = new Error("Query failed");
            vi.mocked(
                postgresDb.query.ganttCurriculumEventConfigurationsSchema.findFirst
            ).mockRejectedValueOnce(dbError);

            await expect(
                DbModuleEvent.getAllocatedTime("e1", "curr1")
            ).rejects.toThrow("Query failed");
        });

        it("returns allocated duration when found", async () => {
            vi.mocked(
                postgresDb.query.ganttCurriculumEventConfigurationsSchema.findFirst
            ).mockResolvedValueOnce({
                allocatedDuration: 250,
            });

            const result = await DbModuleEvent.getAllocatedTime("e1", "curr1");

            expect(result).toBe(250);
        });

        it("handles null allocated duration", async () => {
            vi.mocked(
                postgresDb.query.ganttCurriculumEventConfigurationsSchema.findFirst
            ).mockResolvedValueOnce({
                allocatedDuration: null,
            });

            const result = await DbModuleEvent.getAllocatedTime("e1", "curr1");

            expect(result).toBe(0);
        });
    });

    describe("setAllocatedTime", () => {
        it("throws error when database insert fails", async () => {
            const dbError = new Error("Insert failed");
            vi.mocked(postgresDb.insert).mockReturnValue(createChain(dbError, true));

            await expect(
                DbModuleEvent.setAllocatedTime("e1", "curr1", 100)
            ).rejects.toThrow("Insert failed");
        });

        it("sets allocated duration successfully", async () => {
            vi.mocked(postgresDb.insert).mockReturnValue(createChain(undefined));

            await expect(
                DbModuleEvent.setAllocatedTime("e1", "curr1", 200)
            ).resolves.toBeUndefined();
        });

        it("handles zero duration", async () => {
            vi.mocked(postgresDb.insert).mockReturnValue(createChain(undefined));

            await expect(
                DbModuleEvent.setAllocatedTime("e1", "curr1", 0)
            ).resolves.toBeUndefined();
        });

        it("handles negative duration", async () => {
            vi.mocked(postgresDb.insert).mockReturnValue(createChain(undefined));

            await expect(
                DbModuleEvent.setAllocatedTime("e1", "curr1", -100)
            ).resolves.toBeUndefined();
        });

        it("updates allocated time on conflict", async () => {
            const chain = createChain(undefined);
            vi.mocked(postgresDb.insert).mockReturnValue(chain);

            await DbModuleEvent.setAllocatedTime("e1", "curr1", 300);

            expect(chain.onConflictDoUpdate).toHaveBeenCalled();
        });
    });

    describe("Edge Cases", () => {
        it("handles very long allocated duration", async () => {
            vi.mocked(postgresDb.insert).mockReturnValue(createChain(undefined));

            await expect(
                DbModuleEvent.setAllocatedTime("e1", "curr1", Number.MAX_SAFE_INTEGER)
            ).resolves.toBeUndefined();
        });
    });
});
