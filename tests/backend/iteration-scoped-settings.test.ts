import { describe, it, expect, vi, afterEach } from "vitest";

import { iterationEndpoint } from "@/api-client/iteration-query";
import {
    apiGetPrayerSettings,
    apiSetPrayerSettings,
} from "@/api-client/prayer";
import {
    apiGetScheduleSettings,
    apiSetScheduleSettings,
} from "@/api-client/schedule-settings";
import { apiGetSetting, apiSetSetting } from "@/api-client/settings";

function mockFetchOnce(data: unknown) {
    global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ "content-type": "application/json" }),
        redirected: false,
        json: async () => ({ status: 0, data }),
    } as unknown as Response);
}

function requestedUrl(): string {
    return String(vi.mocked(global.fetch).mock.calls[0][0]);
}

describe("iterationEndpoint", () => {
    it("leaves the path untouched for the current iteration", () => {
        expect(iterationEndpoint("/api/settings/prayerTimes")).toBe(
            "/api/settings/prayerTimes",
        );
    });

    it("appends the iteration and escapes it", () => {
        expect(iterationEndpoint("/api/settings/prayerTimes", "2026 b")).toBe(
            "/api/settings/prayerTimes?it=2026%20b",
        );
    });

    it("joins onto an existing query string", () => {
        expect(iterationEndpoint("/api/event?sd=x", "2026b")).toBe(
            "/api/event?sd=x&it=2026b",
        );
    });
});

describe("settings api-client — iteration scoping", () => {
    const originalFetch = global.fetch;
    afterEach(() => {
        global.fetch = originalFetch;
        vi.restoreAllMocks();
    });

    it("reads a setting from the requested iteration's database", async () => {
        mockFetchOnce({});
        await apiGetSetting("prayerTimes", "2025a");
        expect(requestedUrl()).toBe("/api/settings/prayerTimes?it=2025a");
    });

    it("writes a setting into the requested iteration's database", async () => {
        mockFetchOnce({});
        await apiSetSetting("prayerTimes", { shacharit: "06:00" }, "2025a");
        const [url, init] = vi.mocked(global.fetch).mock.calls[0];
        expect(String(url)).toBe("/api/settings/prayerTimes?it=2025a");
        expect(init?.method).toBe("POST");
    });

    it("omits the iteration entirely for the current run", async () => {
        mockFetchOnce({});
        await apiGetSetting("prayerTimes");
        expect(requestedUrl()).toBe("/api/settings/prayerTimes");
    });

    it("scopes prayer settings", async () => {
        mockFetchOnce({});
        await apiGetPrayerSettings("2025a");
        expect(requestedUrl()).toContain("it=2025a");

        vi.mocked(global.fetch).mockClear();
        mockFetchOnce({});
        await apiSetPrayerSettings({} as never, "2025a");
        expect(requestedUrl()).toContain("it=2025a");
    });

    it("scopes schedule settings", async () => {
        mockFetchOnce({});
        await apiGetScheduleSettings("2025a");
        expect(requestedUrl()).toContain("it=2025a");

        vi.mocked(global.fetch).mockClear();
        mockFetchOnce({});
        await apiSetScheduleSettings(
            { dayStartTime: "08:00", weekendHomeStartTime: "20:00" },
            "2025a",
        );
        expect(requestedUrl()).toContain("it=2025a");
    });
});
