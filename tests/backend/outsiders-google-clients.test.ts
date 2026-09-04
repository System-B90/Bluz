import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
    apiConnectGoogleCalendar,
    apiDisconnectGoogleCalendar,
    apiGetGoogleCalendarStatus,
    apiSyncGoogleCalendarNow,
} from "@/api-client/google-calendar";
import {
    apiCreateOutsider,
    apiDeleteOutsider,
    apiGetOutsiders,
    apiUpdateOutsider,
} from "@/api-client/outsiders";

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

const outsider = { id: "o1", name: "איש חוץ" };

describe("outsiders api-client", () => {
    const originalFetch = global.fetch;
    beforeEach(() => {
        global.fetch = vi.fn().mockResolvedValue(okJson([ outsider ]));
    });
    afterEach(() => {
        global.fetch = originalFetch;
        vi.restoreAllMocks();
    });

    it("reads the list", async () => {
        await expect(apiGetOutsiders()).resolves.toEqual([ outsider ]);
        expect(lastCall().url).toBe("/api/outsiders");
    });

    it("uses PUT to create and POST to update, on one endpoint", async () => {
        await apiCreateOutsider(outsider as never);
        expect(lastCall().init?.method).toBe("PUT");
        expect(JSON.parse(String(lastCall().init?.body))).toEqual(outsider);

        await apiUpdateOutsider(outsider as never);
        expect(lastCall().init?.method).toBe("POST");
    });

    it("deletes by sending the bare id as the body", async () => {
        await apiDeleteOutsider("o1" as never);

        const { url, init } = lastCall();
        expect(url).toBe("/api/outsiders");
        expect(init?.method).toBe("DELETE");
        expect(init?.body).toBe(JSON.stringify("o1"));
    });

    it("propagates a server error", async () => {
        vi.mocked(global.fetch).mockResolvedValueOnce({
            ok: false,
            status: 400,
            statusText: "Bad Request",
            redirected: false,
            headers: new Headers({ "content-type": "application/json" }),
            json: async () => ({ status: 1, error: { message: "לא תקין" } }),
        } as unknown as Response);

        await expect(apiCreateOutsider(outsider as never)).rejects.toThrow();
    });
});

describe("google-calendar api-client", () => {
    const originalFetch = global.fetch;
    beforeEach(() => {
        global.fetch = vi.fn().mockResolvedValue(okJson({ connected: true }));
    });
    afterEach(() => {
        global.fetch = originalFetch;
        vi.restoreAllMocks();
    });

    it("reads the status with a plain GET", async () => {
        await expect(apiGetGoogleCalendarStatus()).resolves.toEqual({
            connected: true,
        });

        const { url, init } = lastCall();
        expect(url).toBe("/api/integrations/google-calendar/status");
        expect(init?.method).toBeUndefined();
    });

    it("posts the GIS authorization code to the connect endpoint", async () => {
        await apiConnectGoogleCalendar({ code: "auth-code" } as never);

        const { url, init } = lastCall();
        expect(url).toBe("/api/integrations/google-calendar/connect");
        expect(init?.method).toBe("POST");
        expect(JSON.parse(String(init?.body))).toEqual({ code: "auth-code" });
    });

    it("posts to disconnect and to sync, with no body", async () => {
        await apiDisconnectGoogleCalendar();
        expect(lastCall().url).toBe(
            "/api/integrations/google-calendar/disconnect",
        );
        expect(lastCall().init?.method).toBe("POST");
        expect(lastCall().init?.body).toBeUndefined();

        await apiSyncGoogleCalendarNow();
        expect(lastCall().url).toBe("/api/integrations/google-calendar/sync");
    });

    it("forwards a caller's abort signal", async () => {
        const controller = new AbortController();

        await apiGetGoogleCalendarStatus({ signal: controller.signal });

        expect(lastCall().init?.signal).toBeDefined();
    });
});
