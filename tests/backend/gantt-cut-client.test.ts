import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { cutCurriculumToSchedule } from "@/api-client/gantt/cut";
import { CurriculumCutError } from "@/api-shared/types/gantt/cut";

function mockFetch(jsonBody: unknown) {
    return vi.fn(async () => ({
        redirected: false,
        json: async () => jsonBody,
    }));
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.unstubAllGlobals());

describe("cutCurriculumToSchedule (client)", () => {
    it("POSTs to the cut endpoint and returns the summary", async () => {
        const fetchMock = mockFetch({
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
            mockFetch({
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
            expect.unreachable("should have thrown");
        } catch (error) {
            const cutError = error as CurriculumCutError;
            expect(cutError.code).toBe("invalid-plan");
            expect(cutError.errors).toHaveLength(1);
            expect(cutError.message).toBe("bad plan");
        }
    });

    it("surfaces the already-cut count", async () => {
        vi.stubGlobal(
            "fetch",
            mockFetch({
                status: -1,
                error: { code: "already-cut", count: 7, message: "cut" },
            }),
        );

        try {
            await cutCurriculumToSchedule("c1");
            expect.unreachable("should have thrown");
        } catch (error) {
            expect((error as CurriculumCutError).count).toBe(7);
        }
    });

    it("rethrows a plain ClientApiError when the failure carries no cut code", async () => {
        vi.stubGlobal(
            "fetch",
            mockFetch({
                status: -1,
                error: { name: "InternalServerError", message: "boom" },
            }),
        );

        try {
            await cutCurriculumToSchedule("c1");
            expect.unreachable("should have thrown");
        } catch (error) {
            expect(error).not.toBeInstanceOf(CurriculumCutError);
            expect((error as Error).message).toBe("boom");
        }
    });
});
