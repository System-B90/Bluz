import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fetchCurriculumExecution } from "@/api-client/gantt/execution";

function mockFetch(jsonBody: unknown) {
    return vi.fn(async () => ({
        ok: true,
        headers: new Headers({ "content-type": "application/json" }),
        redirected: false,
        json: async () => jsonBody,
    }));
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.unstubAllGlobals());

describe("fetchCurriculumExecution (client)", () => {
    it("GETs the execution endpoint and returns the comparison", async () => {
        const fetchMock = mockFetch({
            status: 0,
            data: { events: { e1: { drifted: true } } },
        });
        vi.stubGlobal("fetch", fetchMock);

        const result = await fetchCurriculumExecution("c1");
        expect(result.events.e1.drifted).toBe(true);
        const [url] = fetchMock.mock.calls[0] as [string];
        expect(url).toBe("/api/gantt/curriculums/c1/execution");
    });

    it("resolves the empty comparison for an un-cut curriculum", async () => {
        vi.stubGlobal("fetch", mockFetch({ status: 0, data: { events: {} } }));
        const result = await fetchCurriculumExecution("c1");
        expect(result.events).toEqual({});
    });

    it("throws on a server error payload", async () => {
        vi.stubGlobal(
            "fetch",
            mockFetch({
                status: -1,
                error: { name: "InternalServerError", message: "boom" },
            }),
        );
        await expect(fetchCurriculumExecution("c1")).rejects.toThrow("boom");
    });
});
