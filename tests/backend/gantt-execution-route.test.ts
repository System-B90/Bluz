import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/api-server/gantt/execution", () => ({
    getCurriculumExecution: vi.fn(),
}));

import { getCurriculumExecution } from "@/api-server/gantt/execution";
import * as ExecutionRoute from "@/app/api/gantt/curriculums/[id]/execution/route";

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const get = (id: string) =>
    ExecutionRoute.GET(
        new NextRequest(
            `http://localhost/api/gantt/curriculums/${id}/execution`,
        ) as any,
        ctx(id) as any,
    );

beforeEach(() => vi.clearAllMocks());

describe("GET /api/gantt/curriculums/[id]/execution", () => {
    it("returns 200 with the execution comparison", async () => {
        vi.mocked(getCurriculumExecution).mockResolvedValue({
            events: {
                e1: {
                    ganttEventId: "e1",
                    occurrences: [],
                    totals: {
                        plannedMinutes: 60,
                        actualMinutes: 60,
                        occurrencesPlanned: 1,
                        occurrencesActual: 1,
                    },
                    drifted: false,
                },
            },
        } as any);

        const res = await get("c1");
        const body = await res.json();
        expect(res.status).toBe(200);
        expect(body.data.events.e1.drifted).toBe(false);
        expect(getCurriculumExecution).toHaveBeenCalledWith("c1");
    });

    it("returns 200 with empty events for an un-cut curriculum", async () => {
        vi.mocked(getCurriculumExecution).mockResolvedValue({ events: {} });
        const res = await get("c1");
        const body = await res.json();
        expect(res.status).toBe(200);
        expect(body.data.events).toEqual({});
    });

    it("maps a thrown server error to a non-200 response", async () => {
        vi.mocked(getCurriculumExecution).mockRejectedValue(
            new Error("db down"),
        );
        const res = await get("c1");
        expect(res.status).toBeGreaterThanOrEqual(400);
    });
});
