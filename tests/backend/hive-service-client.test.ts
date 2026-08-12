import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Unit tests for the service-account login behind the lesson activator.
 *
 * The activator runs every 30 seconds and makes several Hive calls per pass,
 * so the thing to hold onto is that it logs in rarely — and that a missing
 * credential is a loud, specific failure rather than a silent anonymous call.
 */

import {
    createHiveServiceClient,
    hasHiveServiceCredentials,
    resetHiveServiceClient,
} from "@/api-server/hive/service-client";
import { HiveClientError } from "@/api-shared/errors";

const FETCH_OK = {
    json: async () => ({ access: "access-token", refresh: "refresh-token" }),
    ok: true,
    status: 200,
};

beforeEach(() => {
    resetHiveServiceClient();
    process.env.HIVE_API_USERNAME = "api";
    process.env.HIVE_API_PASSWORD = "Password1";
    process.env.NEXT_PUBLIC_HIVE_URL = "https://hive.example";
});

afterEach(() => {
    vi.unstubAllGlobals();
    resetHiveServiceClient();
});

describe("hasHiveServiceCredentials", () => {
    it("is false when either half is missing", () => {
        delete process.env.HIVE_API_PASSWORD;
        expect(hasHiveServiceCredentials()).toBe(false);

        process.env.HIVE_API_PASSWORD = "Password1";
        delete process.env.HIVE_API_USERNAME;
        expect(hasHiveServiceCredentials()).toBe(false);

        process.env.HIVE_API_USERNAME = "api";
        expect(hasHiveServiceCredentials()).toBe(true);
    });
});

describe("createHiveServiceClient", () => {
    it("posts the credentials to Hive's token endpoint", async () => {
        const fetchMock = vi.fn(async () => FETCH_OK);
        vi.stubGlobal("fetch", fetchMock);

        await createHiveServiceClient();

        expect(fetchMock).toHaveBeenCalledOnce();
        const [url, init] = fetchMock.mock.calls[0] as any;
        expect(url).toBe("https://hive.example/api/core/token/");
        expect(init.method).toBe("POST");
        expect(JSON.parse(init.body)).toEqual({
            password: "Password1",
            username: "api",
        });
    });

    it("reuses the cached client instead of logging in again", async () => {
        const fetchMock = vi.fn(async () => FETCH_OK);
        vi.stubGlobal("fetch", fetchMock);

        const first = await createHiveServiceClient();
        const second = await createHiveServiceClient();

        expect(second).toBe(first);
        expect(fetchMock).toHaveBeenCalledOnce();
    });

    it("logs in again for a different Hive instance", async () => {
        const fetchMock = vi.fn(async () => FETCH_OK);
        vi.stubGlobal("fetch", fetchMock);

        await createHiveServiceClient();
        await createHiveServiceClient("https://other-hive.example");

        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("logs in again once the cached client ages out", async () => {
        const fetchMock = vi.fn(async () => FETCH_OK);
        vi.stubGlobal("fetch", fetchMock);
        vi.useFakeTimers();

        try {
            await createHiveServiceClient();
            // Hive's default access-token lifetime is 60 minutes.
            vi.advanceTimersByTime(60 * 60 * 1000);
            await createHiveServiceClient();
        } finally {
            vi.useRealTimers();
        }

        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("fails loudly when credentials are not configured", async () => {
        delete process.env.HIVE_API_USERNAME;
        const fetchMock = vi.fn(async () => FETCH_OK);
        vi.stubGlobal("fetch", fetchMock);

        await expect(createHiveServiceClient()).rejects.toBeInstanceOf(
            HiveClientError,
        );
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("fails loudly when Hive rejects the credentials", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => ({
                json: async () => ({ detail: "No active account found" }),
                ok: false,
                status: 401,
            })),
        );

        await expect(createHiveServiceClient()).rejects.toThrow(/401/);
    });

    it("fails loudly when Hive answers without a token", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => ({ json: async () => ({}), ok: true, status: 200 })),
        );

        await expect(createHiveServiceClient()).rejects.toBeInstanceOf(
            HiveClientError,
        );
    });
});
