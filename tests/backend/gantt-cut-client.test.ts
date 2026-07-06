import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
    CurriculumCutError,
    cutCurriculumToSchedule,
} from "@/api-client/gantt/cut";

function mockFetch(status: number, jsonBody: unknown) {
    return vi.fn(async () => ({
        ok: status >= 200 && status < 300,
        status,
        json: async () => jsonBody,
    }));
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.unstubAllGlobals());

describe("cutCurriculumToSchedule (client)", () => {
    it("POSTs to the cut endpoint and returns the summary", async () => {
        const fetchMock = mockFetch(200, {
            status: 0,
            data: { createdEvents: 2, createdCourses: [], overlaps: 1 },
        });
        vi.stubGlobal("fetch", fetchMock);

        const result = await cutCurriculumToSchedule("c1");
        expect(result.createdEvents).toBe(2);
        expect(result.overlaps).toBe(1);
        const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
        expect(url).toBe("/api/gantt/curriculums/c1/cut");
        expect(init.method).toBe("POST");
    });

    it("throws a typed CurriculumCutError carrying the structured error", async () => {
        vi.stubGlobal(
            "fetch",
            mockFetch(400, {
                status: -1,
                error: {
                    code: "invalid-plan",
                    errors: [{ type: "unmapped-event", eventId: "e1", title: "x" }],
                    message: "bad plan",
                },
            }),
        );

        await expect(cutCurriculumToSchedule("c1")).rejects.toBeInstanceOf(
            CurriculumCutError,
        );

        try {
            await cutCurriculumToSchedule("c1");
        } catch (error) {
            const cutError = error as CurriculumCutError;
            expect(cutError.cutError.code).toBe("invalid-plan");
            expect(cutError.cutError.errors).toHaveLength(1);
            expect(cutError.message).toBe("bad plan");
        }
    });

    it("surfaces the already-cut count", async () => {
        vi.stubGlobal(
            "fetch",
            mockFetch(409, {
                status: -1,
                error: { code: "already-cut", count: 7, message: "cut" },
            }),
        );

        try {
            await cutCurriculumToSchedule("c1");
            expect.unreachable("should have thrown");
        } catch (error) {
            expect((error as CurriculumCutError).cutError.count).toBe(7);
        }
    });
});
