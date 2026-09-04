import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { apiReorderEvents, apiReorderModules } from "@/api-client/gantt/reorder";
import {
    GanttEventId,
    GanttModuleId,
    GanttSyllabusId,
} from "@/api-shared/types/gantt/models";

function okJson(data: unknown) {
    return {
        ok: true,
        status: 200,
        redirected: false,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({ status: 0, data }),
    } as unknown as Response;
}

function lastCall() {
    const [ url, init ] = vi.mocked(global.fetch).mock.calls.at(-1)!;
    return { url: String(url), init };
}

describe("gantt reorder api-client", () => {
    const originalFetch = global.fetch;
    beforeEach(() => {
        global.fetch = vi.fn().mockResolvedValue(okJson(null));
    });
    afterEach(() => {
        global.fetch = originalFetch;
        vi.restoreAllMocks();
    });

    it("POSTs the module order to its syllabus", async () => {
        await apiReorderModules("s1" as GanttSyllabusId, [
            "m2",
            "m1",
        ] as Array<GanttModuleId>);

        const { url, init } = lastCall();
        expect(url).toBe("/api/gantt/syllabuses/s1/reorder-modules");
        expect(init?.method).toBe("POST");
        expect(JSON.parse(String(init?.body))).toEqual({
            moduleIds: [ "m2", "m1" ],
        });
    });

    it("POSTs the event order to its module", async () => {
        await apiReorderEvents("m1" as GanttModuleId, [
            "e2",
            "e1",
        ] as Array<GanttEventId>);

        const { url, init } = lastCall();
        expect(url).toBe("/api/gantt/modules/m1/reorder-events");
        expect(JSON.parse(String(init?.body))).toEqual({
            eventIds: [ "e2", "e1" ],
        });
    });

    it("escapes an id that would otherwise break the path", async () => {
        await apiReorderModules("s/1?x" as GanttSyllabusId, []);

        expect(lastCall().url).toBe(
            "/api/gantt/syllabuses/s%2F1%3Fx/reorder-modules",
        );
    });

    it("propagates a server failure to the caller", async () => {
        vi.mocked(global.fetch).mockResolvedValueOnce({
            ok: false,
            status: 500,
            statusText: "Internal Server Error",
            redirected: false,
            headers: new Headers({ "content-type": "text/html" }),
            json: async () => ({}),
        } as unknown as Response);

        await expect(
            apiReorderEvents("m1" as GanttModuleId, []),
        ).rejects.toThrow();
    });
});
