import { describe, it, expect, vi, afterEach } from "vitest";

import {
    apiGetCustomColors,
    apiCreateCustomColor,
    apiUpdateCustomColor,
    apiDeleteCustomColor,
} from "@/api-client/custom-colors";

describe("custom-colors api-client", () => {
    const originalFetch = global.fetch;
    afterEach(() => {
        global.fetch = originalFetch;
        vi.restoreAllMocks();
    });

    it("apiGetCustomColors GETs the endpoint and unwraps data", async () => {
        const colors = [ { id: "c1", name: "Red", hex: "#ff0000" } ];
        global.fetch = vi.fn().mockResolvedValueOnce({
            redirected: false,
            json: async () => ({ status: 0, data: colors }),
        } as unknown as Response);

        const result = await apiGetCustomColors({});

        const [ url ] = vi.mocked(global.fetch).mock.calls[0];
        expect(url).toBe("/api/custom-colors");
        expect(result).toEqual(colors);
    });

    it("apiCreateCustomColor PUTs the color as JSON", async () => {
        const color = { id: "c1", name: "Red", hex: "#ff0000" };
        global.fetch = vi.fn().mockResolvedValueOnce({
            redirected: false,
            json: async () => ({ status: 0, data: color }),
        } as unknown as Response);

        const result = await apiCreateCustomColor(color, {});

        const [ url, init ] = vi.mocked(global.fetch).mock.calls[0];
        expect(url).toBe("/api/custom-colors");
        expect(init?.method).toBe("PUT");
        expect(init?.body).toBe(JSON.stringify(color));
        expect(result).toEqual(color);
    });

    it("apiUpdateCustomColor POSTs the color as JSON", async () => {
        const color = { id: "c1", name: "Red Updated", hex: "#ee0000" };
        global.fetch = vi.fn().mockResolvedValueOnce({
            redirected: false,
            json: async () => ({ status: 0, data: color }),
        } as unknown as Response);

        const result = await apiUpdateCustomColor(color, {});

        const [ url, init ] = vi.mocked(global.fetch).mock.calls[0];
        expect(url).toBe("/api/custom-colors");
        expect(init?.method).toBe("POST");
        expect(init?.body).toBe(JSON.stringify(color));
        expect(result).toEqual(color);
    });

    it("apiDeleteCustomColor DELETEs with the color id as the body", async () => {
        global.fetch = vi.fn().mockResolvedValueOnce({
            redirected: false,
            json: async () => ({ status: 0, data: undefined }),
        } as unknown as Response);

        await apiDeleteCustomColor("c1", {});

        const [ url, init ] = vi.mocked(global.fetch).mock.calls[0];
        expect(url).toBe("/api/custom-colors");
        expect(init?.method).toBe("DELETE");
        expect(init?.body).toBe(JSON.stringify("c1"));
    });

    it("throws a ClientApiError when the API reports an error status", async () => {
        global.fetch = vi.fn().mockResolvedValueOnce({
            redirected: false,
            json: async () => ({
                status: 1,
                error: { name: "GenericError", message: "boom" },
            }),
        } as unknown as Response);

        await expect(apiGetCustomColors({})).rejects.toThrow();
    });
});
