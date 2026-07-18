import { describe, it, expect, vi, beforeEach } from "vitest";
import { ConstraintType } from "@/api-shared/types/gantt/models/constraint";

vi.mock("@/api-client/common", () => ({
    safeApiFetcher: vi.fn(),
}));

import { safeApiFetcher } from "@/api-client/common";
import {
    ganttConstraintsApi,
    CreateConstraintPayload,
} from "@/api-client/gantt/constraints";

describe("GanttConstraints Client - Failure Paths", () => {
    beforeEach(() => {
        vi.stubGlobal("window", { location: { origin: "http://localhost" } });
        vi.clearAllMocks();
    });

    describe("normalizeConstraintObject - Relational Constraints", () => {
        it("throws error when relational constraint missing targetEventId for event target", async () => {
            const malformedConstraint = {
                id: "c1",
                type: ConstraintType.Relational,
                ownerEventId: "e1",
                targetModuleId: null,
                targetEventId: null,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };

            vi.mocked(safeApiFetcher).mockResolvedValueOnce(malformedConstraint);

            await expect(
                ganttConstraintsApi.apiCreate("curr1", malformedConstraint as unknown as CreateConstraintPayload)
            ).rejects.toThrow(/Malformed constraint! Target type is "event"/);
        });

        it("throws error when relational constraint missing ownerEventId for event owner", async () => {
            const malformedConstraint = {
                id: "c1",
                type: ConstraintType.Relational,
                ownerEventId: null,
                ownerModuleId: null,
                targetEventId: "e2",
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };

            vi.mocked(safeApiFetcher).mockResolvedValueOnce(malformedConstraint);

            await expect(
                ganttConstraintsApi.apiCreate("curr1", malformedConstraint as unknown as CreateConstraintPayload)
            ).rejects.toThrow(/Malformed constraint! Owner type is "event"/);
        });

        it("prefers targetModuleId over targetEventId when both are present", async () => {
            const ambiguousConstraint = {
                id: "c1",
                type: ConstraintType.Relational,
                ownerEventId: "e1",
                targetEventId: "e2",
                targetModuleId: "m2",
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };

            vi.mocked(safeApiFetcher).mockResolvedValueOnce(ambiguousConstraint);

            const result = await ganttConstraintsApi.apiCreate(
                "curr1",
                ambiguousConstraint as unknown as CreateConstraintPayload
            );

            expect(result.targetType).toBe("module");
            expect(result.targetId).toBe("e2");
        });
    });

    describe("normalizeConstraintObject - Temporal Constraints", () => {
        it("throws error when temporal constraint missing ownerEventId for event owner", async () => {
            const malformedConstraint = {
                id: "c1",
                type: ConstraintType.Temporal,
                ownerEventId: null,
                ownerModuleId: null,
                duration: 100,
                dueDate: new Date().toISOString(),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };

            vi.mocked(safeApiFetcher).mockResolvedValueOnce(malformedConstraint);

            await expect(
                ganttConstraintsApi.apiCreate("curr1", malformedConstraint as unknown as CreateConstraintPayload)
            ).rejects.toThrow(/Malformed constraint! Owner type is "event"/);
        });
    });

    describe("normalizeConstraintObject - Unknown Type", () => {
        it("throws error for unknown constraint type", async () => {
            const unknownConstraint = {
                id: "c1",
                type: "UnknownType",
                ownerEventId: "e1",
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };

            vi.mocked(safeApiFetcher).mockResolvedValueOnce(unknownConstraint);

            await expect(
                ganttConstraintsApi.apiCreate("curr1", unknownConstraint as unknown as CreateConstraintPayload)
            ).rejects.toThrow(/Malformed constraint! Unknown constraint type/);
        });

        it("throws error when constraint type is null", async () => {
            const nullTypeConstraint = {
                id: "c1",
                type: null,
                ownerEventId: "e1",
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };

            vi.mocked(safeApiFetcher).mockResolvedValueOnce(nullTypeConstraint);

            await expect(
                ganttConstraintsApi.apiCreate("curr1", nullTypeConstraint as unknown as CreateConstraintPayload)
            ).rejects.toThrow(/Malformed constraint! Unknown constraint type/);
        });
    });

    describe("API Error Handling", () => {
        it("propagates network error from apiGetConstraints", async () => {
            const networkError = new Error("Network timeout");
            vi.mocked(safeApiFetcher).mockRejectedValueOnce(networkError);

            await expect(
                ganttConstraintsApi.apiGet("curr1", {})
            ).rejects.toThrow("Network timeout");
        });

        it("propagates network error from apiCreateConstraint", async () => {
            const networkError = new Error("Server error");
            vi.mocked(safeApiFetcher).mockRejectedValueOnce(networkError);

            await expect(
                ganttConstraintsApi.apiCreate("curr1", {
                    type: ConstraintType.Relational,
                    ownerEventId: "e1",
                    targetEventId: "e2",
                } as unknown as CreateConstraintPayload)
            ).rejects.toThrow("Server error");
        });

        it("propagates network error from apiUpdateConstraint", async () => {
            const networkError = new Error("Update failed");
            vi.mocked(safeApiFetcher).mockRejectedValueOnce(networkError);

            await expect(
                ganttConstraintsApi.apiUpdate("curr1", "c1", {
                    duration: 200,
                })
            ).rejects.toThrow("Update failed");
        });

        it("propagates network error from apiDeleteConstraint", async () => {
            const networkError = new Error("Delete failed");
            vi.mocked(safeApiFetcher).mockRejectedValueOnce(networkError);

            await expect(
                ganttConstraintsApi.apiDelete("curr1", "c1")
            ).rejects.toThrow("Delete failed");
        });
    });

    describe("Edge Cases", () => {
        it("handles empty constraints list", async () => {
            vi.mocked(safeApiFetcher).mockResolvedValueOnce([]);

            const result = await ganttConstraintsApi.apiGet("curr1", {});
            expect(result).toEqual([]);
        });

        it("normalizes multiple constraints correctly when all valid", async () => {
            const validConstraints = [
                {
                    id: "c1",
                    type: ConstraintType.Relational,
                    ownerEventId: "e1",
                    targetModuleId: "m2",
                    ownerModuleId: null,
                    targetEventId: null,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                },
                {
                    id: "c2",
                    type: ConstraintType.Temporal,
                    ownerModuleId: "m1",
                    ownerEventId: null,
                    duration: 100,
                    dueDate: new Date().toISOString(),
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                },
            ];

            vi.mocked(safeApiFetcher).mockResolvedValueOnce(validConstraints);

            const result = await ganttConstraintsApi.apiGet("curr1", {});
            expect(result).toHaveLength(2);
            expect(result[0].ownerType).toBe("event");
            expect(result[0].targetType).toBe("module");
            expect(result[1].ownerType).toBe("module");
        });
    });
});
