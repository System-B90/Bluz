// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
    apiCreateDraft,
    apiDeleteDraft,
    apiGetDraft,
    apiListDrafts,
    apiUpdateDraft,
} from "@/api-client/calendar-drafts";
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

describe("calendar-drafts api-client", () => {
    const originalFetch = global.fetch;
    beforeEach(() => {
        global.fetch = vi.fn();
    });
    afterEach(() => {
        global.fetch = originalFetch;
        vi.restoreAllMocks();
    });

    it("apiListDrafts GETs the drafts endpoint", async () => {
        const summaries = [ { id: "d1", label: "טיוטה" } ];
        vi.mocked(global.fetch).mockResolvedValueOnce(okJson(summaries));

        await expect(apiListDrafts()).resolves.toEqual(summaries);

        const { url, init } = lastCall();
        expect(url.pathname).toBe("/api/calendar/drafts");
        expect(url.searchParams.get("it")).toBeNull();
        expect(init?.method).toBe("GET");
    });

    it("scopes every call to the selected iteration", async () => {
        vi.mocked(global.fetch).mockResolvedValue(okJson([]));

        await apiListDrafts(IT);
        expect(lastCall().url.searchParams.get("it")).toBe(IT);

        await apiCreateDraft("x", [], IT);
        expect(lastCall().url.searchParams.get("it")).toBe(IT);

        await apiDeleteDraft("d1", IT);
        expect(lastCall().url.searchParams.get("it")).toBe(IT);
    });

    it("apiCreateDraft POSTs the label and events", async () => {
        vi.mocked(global.fetch).mockResolvedValueOnce(
            okJson({ id: "d1", label: "טיוטה" }),
        );

        await apiCreateDraft("טיוטה", [ { id: "e1" } as unknown as Event ]);

        const { init } = lastCall();
        expect(init?.method).toBe("POST");
        expect(JSON.parse(String(init?.body))).toEqual({
            label: "טיוטה",
            events: [ { id: "e1" } ],
        });
    });

    it("apiUpdateDraft PUTs the id, and omits an unset label", async () => {
        vi.mocked(global.fetch).mockResolvedValue(okJson({ id: "d1" }));

        await apiUpdateDraft("d1", []);
        expect(lastCall().init?.method).toBe("PUT");
        expect(JSON.parse(String(lastCall().init?.body))).toEqual({
            id: "d1",
            events: [],
        });

        await apiUpdateDraft("d1", [], IT, "שם חדש");
        expect(JSON.parse(String(lastCall().init?.body)).label).toBe("שם חדש");
    });

    it("apiGetDraft asks for one id and converts its events to Dayjs", async () => {
        vi.mocked(global.fetch).mockResolvedValueOnce(
            okJson({
                id: "d1",
                label: "טיוטה",
                events: [
                    {
                        id: "e1",
                        startTime: "2026-03-01T08:00:00.000Z",
                        endTime: "2026-03-01T10:00:00.000Z",
                    },
                ],
            }),
        );

        const { draft, events } = await apiGetDraft("d1");

        expect(lastCall().url.searchParams.get("id")).toBe("d1");
        expect(draft.id).toBe("d1");
        expect(dayjs.isDayjs(events[ 0 ].startTime)).toBe(true);
        expect(events[ 0 ].startTime.toISOString()).toBe(
            "2026-03-01T08:00:00.000Z",
        );
    });

    it("apiGetDraft tolerates a draft with no events array", async () => {
        vi.mocked(global.fetch).mockResolvedValueOnce(okJson({ id: "d1" }));

        await expect(apiGetDraft("d1")).resolves.toMatchObject({ events: [] });
    });

    it("apiDeleteDraft sends DELETE with the id", async () => {
        vi.mocked(global.fetch).mockResolvedValueOnce(okJson(null));

        await apiDeleteDraft("d1");

        const { url, init } = lastCall();
        expect(init?.method).toBe("DELETE");
        expect(url.searchParams.get("id")).toBe("d1");
    });

    it("propagates a server error instead of resolving", async () => {
        vi.mocked(global.fetch).mockResolvedValueOnce({
            ok: false,
            status: 500,
            statusText: "Internal Server Error",
            redirected: false,
            headers: new Headers({ "content-type": "text/html" }),
            json: async () => ({}),
        } as unknown as Response);

        await expect(apiListDrafts()).rejects.toThrow();
    });
});
