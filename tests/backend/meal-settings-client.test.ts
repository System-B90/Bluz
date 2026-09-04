import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
    apiGetMealSettings,
    apiSetMealSettings,
} from "@/api-client/meal-settings";
import { IterationId } from "@/api-shared/types/iteration";
import { MealSettings } from "@/api-shared/types/settings/meal";

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
    return { url: String(url), init };
}

describe("meal-settings api-client", () => {
    const originalFetch = global.fetch;
    beforeEach(() => {
        global.fetch = vi.fn();
    });
    afterEach(() => {
        global.fetch = originalFetch;
        vi.restoreAllMocks();
    });

    it("reads the mealTimes setting for the current run", async () => {
        vi.mocked(global.fetch).mockResolvedValueOnce(okJson({ meals: [] }));

        await apiGetMealSettings();

        expect(lastCall().url).toBe("/api/settings/mealTimes");
    });

    it("scopes the read to a selected iteration", async () => {
        vi.mocked(global.fetch).mockResolvedValueOnce(okJson({ meals: [] }));

        await apiGetMealSettings(IT);

        expect(lastCall().url).toBe("/api/settings/mealTimes?it=2026-a");
    });

    it("writes the settings as a JSON POST body", async () => {
        vi.mocked(global.fetch).mockResolvedValueOnce(okJson({ ok: true }));
        const settings = { meals: [ { name: "צהריים" } ] } as unknown as MealSettings;

        await apiSetMealSettings(settings, IT);

        const { url, init } = lastCall();
        expect(url).toBe("/api/settings/mealTimes?it=2026-a");
        expect(init?.method).toBe("POST");
        expect(init?.body).toBe(JSON.stringify(settings));
    });
});
