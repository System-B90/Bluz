import { describe, it, expect, vi, afterEach } from "vitest";

import {
    apiGetPersonalSettings,
    apiSetPersonalSettings,
} from "@/api-client/personal-settings";

describe("personal-settings api-client", () => {
    const originalFetch = global.fetch;
    afterEach(() => {
        global.fetch = originalFetch;
        vi.restoreAllMocks();
    });

    it("apiGetPersonalSettings GETs the endpoint and unwraps data", async () => {
        const settings = {
            groups: [ "g1" ],
            instructors: [],
            favoriteOutsiders: [],
        };
        global.fetch = vi.fn().mockResolvedValueOnce({
            redirected: false,
            json: async () => ({ status: 0, data: settings }),
        } as unknown as Response);

        const result = await apiGetPersonalSettings({});

        expect(global.fetch).toHaveBeenCalledWith(
            "/api/personal-settings",
            expect.objectContaining({ headers: expect.any(Headers) }),
        );
        expect(result).toEqual(settings);
    });

    it("apiSetPersonalSettings POSTs the payload as JSON", async () => {
        const settings = {
            groups: [ "g1" ],
            instructors: [ "i1" ],
            favoriteOutsiders: [],
        };
        global.fetch = vi.fn().mockResolvedValueOnce({
            redirected: false,
            json: async () => ({ status: 0, data: settings }),
        } as unknown as Response);

        const result = await apiSetPersonalSettings(settings, {});

        const [ url, init ] = vi.mocked(global.fetch).mock.calls[0];
        expect(url).toBe("/api/personal-settings");
        expect(init?.method).toBe("POST");
        expect(init?.body).toBe(JSON.stringify(settings));
        expect(result).toEqual(settings);
    });

    it("throws a ClientApiError when the API reports an error status", async () => {
        global.fetch = vi.fn().mockResolvedValueOnce({
            redirected: false,
            json: async () => ({
                status: 1,
                error: { name: "GenericError", message: "boom" },
            }),
        } as unknown as Response);

        await expect(apiGetPersonalSettings({})).rejects.toThrow();
    });
});
