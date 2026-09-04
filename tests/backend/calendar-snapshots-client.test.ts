// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
    apiCreateSnapshot,
    apiDeleteSnapshot,
    apiGetSnapshot,
    apiListSnapshots,
    apiRestoreSnapshot,
} from "@/api-client/calendar-snapshots";
import { dayjs } from "@/api-shared/dayjs-setup";
import { Event } from "@/api-shared/types/event";
import { IterationId } from "@/api-shared/types/iteration";

const IT = "2026-a" as IterationId;

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
    return { url: new URL(String(url)), init };
}

describe("calendar-snapshots api-client", () => {
    const originalFetch = global.fetch;
    beforeEach(() => {
        global.fetch = vi.fn();
    });
    afterEach(() => {
        global.fetch = originalFetch;
        vi.restoreAllMocks();
    });

    it("apiListSnapshots GETs the snapshots endpoint", async () => {
        const summaries = [ { id: "s1", label: "לפני החיתוך" } ];
        vi.mocked(global.fetch).mockResolvedValueOnce(okJson(summaries));

        await expect(apiListSnapshots()).resolves.toEqual(summaries);

        const { url, init } = lastCall();
        expect(url.pathname).toBe("/api/calendar/snapshots");
        expect(init?.method).toBe("GET");
    });

    it("apiCreateSnapshot POSTs the label and events", async () => {
        vi.mocked(global.fetch).mockResolvedValueOnce(okJson({ id: "s1" }));

        await apiCreateSnapshot("לפני", [ { id: "e1" } as unknown as Event ], IT);

        const { url, init } = lastCall();
        expect(init?.method).toBe("POST");
        expect(url.searchParams.get("it")).toBe(IT);
        expect(JSON.parse(String(init?.body))).toEqual({
            label: "לפני",
            events: [ { id: "e1" } ],
        });
    });

    it("apiGetSnapshot converts captured events back to Dayjs", async () => {
        vi.mocked(global.fetch).mockResolvedValueOnce(
            okJson({
                id: "s1",
                events: [
                    {
                        id: "e1",
                        startTime: "2026-03-01T08:00:00.000Z",
                        endTime: "2026-03-01T10:00:00.000Z",
                    },
                ],
            }),
        );

        const { snapshot, events } = await apiGetSnapshot("s1");

        expect(lastCall().url.searchParams.get("id")).toBe("s1");
        expect(snapshot.id).toBe("s1");
        expect(dayjs.isDayjs(events[ 0 ].endTime)).toBe(true);
    });

    it("apiRestoreSnapshot POSTs to the /restore sub-route", async () => {
        vi.mocked(global.fetch).mockResolvedValueOnce(
            okJson({ archived: 3, restored: 5 }),
        );

        const result = await apiRestoreSnapshot("s1", IT);

        const { url, init } = lastCall();
        expect(url.pathname).toBe("/api/calendar/snapshots/restore");
        expect(url.searchParams.get("id")).toBe("s1");
        expect(url.searchParams.get("it")).toBe(IT);
        expect(init?.method).toBe("POST");
        expect(result).toEqual({ archived: 3, restored: 5 });
    });

    it("apiDeleteSnapshot sends DELETE with the id", async () => {
        vi.mocked(global.fetch).mockResolvedValueOnce(okJson(null));

        await apiDeleteSnapshot("s1");

        const { url, init } = lastCall();
        expect(init?.method).toBe("DELETE");
        expect(url.searchParams.get("id")).toBe("s1");
    });

    it("surfaces the API envelope's error rather than resolving", async () => {
        vi.mocked(global.fetch).mockResolvedValueOnce({
            ok: true,
            status: 200,
            redirected: false,
            headers: new Headers({ "content-type": "application/json" }),
            json: async () => ({ status: 1, error: { message: "nope" } }),
        } as unknown as Response);

        await expect(apiListSnapshots()).rejects.toThrow();
    });
});
