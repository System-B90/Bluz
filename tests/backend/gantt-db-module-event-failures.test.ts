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
import { ClientApiError } from "@/api-shared/errors";

describe("Gantt DB Module Event - Failure Paths", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("getFullModuleEvent", () => {
        it("throws ClientApiError when event not found", async () => {
            vi.mocked(postgresDb.query.ganttEventsSchema.findFirst).mockResolvedValueOnce(null);

            // Import dynamically to use mocked postgresDb
            const { DbModuleEvent } = await import("@/api-server/gantt/db-module-event");

            await expect(DbModuleEvent.getItem("event-not-found")).rejects.toThrow(
                ClientApiError
            );
        });

        it("throws error with Hebrew message when event not found", async () => {
            vi.mocked(postgresDb.query.ganttEventsSchema.findFirst).mockResolvedValueOnce(null);

            const { DbModuleEvent } = await import("@/api-server/gantt/db-module-event");

            await expect(DbModuleEvent.getItem("e123")).rejects.toThrow(/מופע/);
        });

        it("throws error when database query fails", async () => {
            const dbError = new Error("Database connection error");
            vi.mocked(postgresDb.query.ganttEventsSchema.findFirst).mockRejectedValueOnce(
                dbError
            );

            const { DbModuleEvent } = await import("@/api-server/gantt/db-module-event");

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

            const { DbModuleEvent } = await import("@/api-server/gantt/db-module-event");

            const result = await DbModuleEvent.getItem("e1");

            expect(result.id).toBe("e1");
            expect(result.cEC).toBeDefined();
        });
    });

    describe("addEventToModule", () => {
        it("throws error when event already linked to module", async () => {
            const uniqueViolationError = new Error("Unique constraint violation");
            (uniqueViolationError as any).cause = {
                code: "23505", // UNIQUE_VIOLATION
                name: "QueryFailedError",
                severity: "ERROR",
                detail: "duplicate key",
            };

            const mockInsert = vi.fn().mockReturnValue({
                values: vi.fn().mockRejectedValueOnce(uniqueViolationError),
            });
            vi.mocked(postgresDb.insert).mockReturnValue(mockInsert as any);

            const { DbModuleEvent } = await import("@/api-server/gantt/db-module-event");

            await expect(
                DbModuleEvent.linkItem("mod1", "e1")
            ).rejects.toThrow(/כבר משויך/);
        });

        it("throws error when module or event does not exist", async () => {
            const fkViolationError = new Error("Foreign key constraint violation");
            (fkViolationError as any).cause = {
                code: "23503", // FOREIGN_KEY_VIOLATION
                name: "QueryFailedError",
                severity: "ERROR",
                detail: "foreign key constraint failed",
            };

            const mockInsert = vi.fn().mockReturnValue({
                values: vi.fn().mockRejectedValueOnce(fkViolationError),
            });
            vi.mocked(postgresDb.insert).mockReturnValue(mockInsert as any);

            const { DbModuleEvent } = await import("@/api-server/gantt/db-module-event");

            await expect(
                DbModuleEvent.linkItem("non-existent-mod", "non-existent-event")
            ).rejects.toThrow(/מערך או אירוע לא קיימים/);
        });

        it("throws generic error for unknown database error", async () => {
            const unknownError = new Error("Unknown database error");
            (unknownError as any).cause = {
                code: "99999",
                name: "QueryFailedError",
            };

            const mockInsert = vi.fn().mockReturnValue({
                values: vi.fn().mockRejectedValueOnce(unknownError),
            });
            vi.mocked(postgresDb.insert).mockReturnValue(mockInsert as any);

            const { DbModuleEvent } = await import("@/api-server/gantt/db-module-event");

            await expect(
                DbModuleEvent.linkItem("mod1", "e1")
            ).rejects.toThrow(ClientApiError);
        });

        it("retrieves event after successful link", async () => {
            const mockEvent = { id: "e1", title: "Event" };
            const mockInsert = vi.fn().mockReturnValue({
                values: vi.fn().mockResolvedValueOnce({ acknowledged: true }),
            });
            vi.mocked(postgresDb.insert).mockReturnValue(mockInsert as any);
            vi.mocked(postgresDb.query.ganttEventsSchema.findFirst).mockResolvedValueOnce(
                mockEvent
            );

            const { DbModuleEvent } = await import("@/api-server/gantt/db-module-event");

            const result = await DbModuleEvent.linkItem("mod1", "e1");

            expect(result.id).toBe("e1");
        });

        it("throws error when event fetch fails after linking", async () => {
            const mockInsert = vi.fn().mockReturnValue({
                values: vi.fn().mockResolvedValueOnce({ acknowledged: true }),
            });
            vi.mocked(postgresDb.insert).mockReturnValue(mockInsert as any);
            const fetchError = new Error("Event fetch failed");
            vi.mocked(postgresDb.query.ganttEventsSchema.findFirst).mockRejectedValueOnce(
                fetchError
            );

            const { DbModuleEvent } = await import("@/api-server/gantt/db-module-event");

            await expect(
                DbModuleEvent.linkItem("mod1", "e1")
            ).rejects.toThrow("Event fetch failed");
        });
    });

    describe("removeEventFromModule", () => {
        it("throws error when mapping does not exist", async () => {
            const mockDelete = vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                    returning: vi.fn().mockResolvedValueOnce([]),
                }),
            });
            vi.mocked(postgresDb.delete).mockReturnValue(mockDelete as any);

            const { DbModuleEvent } = await import("@/api-server/gantt/db-module-event");

            await expect(
                DbModuleEvent.unlinkItem("mod1", "non-existent-event")
            ).rejects.toThrow(/No mapping found/);
        });

        it("throws error when database delete fails", async () => {
            const dbError = new Error("Delete operation failed");
            const mockDelete = vi.fn().mockReturnValue({
                where: vi.fn().mockRejectedValueOnce(dbError),
            });
            vi.mocked(postgresDb.delete).mockReturnValue(mockDelete as any);

            const { DbModuleEvent } = await import("@/api-server/gantt/db-module-event");

            await expect(
                DbModuleEvent.unlinkItem("mod1", "e1")
            ).rejects.toThrow("Delete operation failed");
        });

        it("successfully removes event-module mapping", async () => {
            const mockDelete = vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                    returning: vi
                        .fn()
                        .mockResolvedValueOnce([{ deletedModuleId: "mod1" }]),
                }),
            });
            vi.mocked(postgresDb.delete).mockReturnValue(mockDelete as any);

            const { DbModuleEvent } = await import("@/api-server/gantt/db-module-event");

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

            const { DbModuleEvent } = await import("@/api-server/gantt/db-module-event");

            const result = await DbModuleEvent.getAllocatedTime("e1", "curr1");

            expect(result).toBe(0);
        });

        it("throws error when database query fails", async () => {
            const dbError = new Error("Query failed");
            vi.mocked(
                postgresDb.query.ganttCurriculumEventConfigurationsSchema.findFirst
            ).mockRejectedValueOnce(dbError);

            const { DbModuleEvent } = await import("@/api-server/gantt/db-module-event");

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

            const { DbModuleEvent } = await import("@/api-server/gantt/db-module-event");

            const result = await DbModuleEvent.getAllocatedTime("e1", "curr1");

            expect(result).toBe(250);
        });

        it("handles null allocated duration", async () => {
            vi.mocked(
                postgresDb.query.ganttCurriculumEventConfigurationsSchema.findFirst
            ).mockResolvedValueOnce({
                allocatedDuration: null,
            });

            const { DbModuleEvent } = await import("@/api-server/gantt/db-module-event");

            const result = await DbModuleEvent.getAllocatedTime("e1", "curr1");

            expect(result).toBe(0);
        });
    });

    describe("setAllocatedTime", () => {
        it("throws error when database insert fails", async () => {
            const dbError = new Error("Insert failed");
            const mockOnConflict = vi.fn().mockRejectedValueOnce(dbError);
            const mockInsert = vi.fn().mockReturnValue({
                values: vi.fn().mockReturnValue({
                    onConflictDoUpdate: mockOnConflict,
                }),
            });
            vi.mocked(postgresDb.insert).mockReturnValue(mockInsert as any);

            const { DbModuleEvent } = await import("@/api-server/gantt/db-module-event");

            await expect(
                DbModuleEvent.setAllocatedTime("e1", "curr1", 100)
            ).rejects.toThrow("Insert failed");
        });

        it("sets allocated duration successfully", async () => {
            const mockOnConflict = vi.fn().mockResolvedValueOnce([]);
            const mockValues = vi.fn().mockReturnValue({
                onConflictDoUpdate: mockOnConflict,
            });
            const mockInsert = vi.fn().mockReturnValue({
                values: mockValues,
            });
            vi.mocked(postgresDb.insert).mockReturnValue(mockInsert as any);

            const { DbModuleEvent } = await import("@/api-server/gantt/db-module-event");

            await expect(
                DbModuleEvent.setAllocatedTime("e1", "curr1", 200)
            ).resolves.toBeUndefined();
        });

        it("handles zero duration", async () => {
            const mockOnConflict = vi.fn().mockResolvedValueOnce([]);
            const mockValues = vi.fn().mockReturnValue({
                onConflictDoUpdate: mockOnConflict,
            });
            const mockInsert = vi.fn().mockReturnValue({
                values: mockValues,
            });
            vi.mocked(postgresDb.insert).mockReturnValue(mockInsert as any);

            const { DbModuleEvent } = await import("@/api-server/gantt/db-module-event");

            await expect(
                DbModuleEvent.setAllocatedTime("e1", "curr1", 0)
            ).resolves.toBeUndefined();
        });

        it("handles negative duration", async () => {
            const mockOnConflict = vi.fn().mockResolvedValueOnce([]);
            const mockValues = vi.fn().mockReturnValue({
                onConflictDoUpdate: mockOnConflict,
            });
            const mockInsert = vi.fn().mockReturnValue({
                values: mockValues,
            });
            vi.mocked(postgresDb.insert).mockReturnValue(mockInsert as any);

            const { DbModuleEvent } = await import("@/api-server/gantt/db-module-event");

            await expect(
                DbModuleEvent.setAllocatedTime("e1", "curr1", -100)
            ).resolves.toBeUndefined();
        });

        it("updates allocated time on conflict", async () => {
            const mockOnConflict = vi.fn().mockResolvedValueOnce([]);
            const mockValues = vi.fn().mockReturnValue({
                onConflictDoUpdate: mockOnConflict,
            });
            const mockInsert = vi.fn().mockReturnValue({
                values: mockValues,
            });
            vi.mocked(postgresDb.insert).mockReturnValue(mockInsert as any);

            const { DbModuleEvent } = await import("@/api-server/gantt/db-module-event");

            await DbModuleEvent.setAllocatedTime("e1", "curr1", 300);

            expect(mockOnConflict).toHaveBeenCalled();
        });
    });

    describe("Edge Cases", () => {
        it("handles empty event ID", async () => {
            vi.mocked(postgresDb.query.ganttEventsSchema.findFirst).mockResolvedValueOnce(null);

            const { DbModuleEvent } = await import("@/api-server/gantt/db-module-event");

            await expect(DbModuleEvent.getItem("")).rejects.toThrow();
        });

        it("handles very long allocated duration", async () => {
            const mockOnConflict = vi.fn().mockResolvedValueOnce([]);
            const mockValues = vi.fn().mockReturnValue({
                onConflictDoUpdate: mockOnConflict,
            });
            const mockInsert = vi.fn().mockReturnValue({
                values: mockValues,
            });
            vi.mocked(postgresDb.insert).mockReturnValue(mockInsert as any);

            const { DbModuleEvent } = await import("@/api-server/gantt/db-module-event");

            await expect(
                DbModuleEvent.setAllocatedTime("e1", "curr1", Number.MAX_SAFE_INTEGER)
            ).resolves.toBeUndefined();
        });
    });
});
