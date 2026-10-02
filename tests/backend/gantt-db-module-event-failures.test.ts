import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/api-server/gantt", () => ({
    postgresDb: {
        query: {
            ganttEventsSchema: {
                findFirst: vi.fn(),
            },
        },
        insert: vi.fn(),
        delete: vi.fn(),
        select: vi.fn(),
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
        // attachParentIds() looks up the parent junction row on every getItem
        vi.mocked(postgresDb.select).mockReturnValue(
            createChain([]) as unknown as ReturnType<typeof postgresDb.select>,
        );
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

        it("returns the event", async () => {
            const mockEvent = {
                id: "e1",
                title: "Event 1",
            };

            vi.mocked(postgresDb.query.ganttEventsSchema.findFirst).mockResolvedValueOnce(
                mockEvent
            );

            const result = await DbModuleEvent.getItem("e1");

            expect(result.id).toBe("e1");
            expect(result.title).toBe("Event 1");
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

});
