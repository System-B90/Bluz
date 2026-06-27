import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";

import { HiveClient } from "@/api-server/hive/client";

function okJson(payload: unknown) {
    return {
        status: 200,
        ok: true,
        text: async () => JSON.stringify(payload),
    } as unknown as Response;
}

const fetchMock = vi.fn(async () => okJson([]));

beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockClear();
});

afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.NEXT_PUBLIC_HIVE_URL;
});

describe("HiveClient per-iteration base URL", () => {
    it("targets the iteration-specific Hive instance", async () => {
        const client = new HiveClient(
            "token",
            "refresh",
            "https://hive-2026b.example",
        );
        await client.getModules();

        const calledUrl = fetchMock.mock.calls[0][0] as string;
        expect(calledUrl).toBe(
            "https://hive-2026b.example/api/core/course/modules/",
        );
    });

    it("strips a trailing slash from the configured base URL", async () => {
        const client = new HiveClient(
            "token",
            undefined,
            "https://hive.example/",
        );
        await client.getSubjects();

        const calledUrl = fetchMock.mock.calls[0][0] as string;
        expect(calledUrl).toBe(
            "https://hive.example/api/core/course/subjects/",
        );
    });

    it("falls back to NEXT_PUBLIC_HIVE_URL when no override is given", async () => {
        process.env.NEXT_PUBLIC_HIVE_URL = "https://default-hive.example";
        const client = new HiveClient("token");
        await client.getRooms();

        const calledUrl = fetchMock.mock.calls[0][0] as string;
        expect(calledUrl).toContain("https://default-hive.example");
    });

    it("sends the bearer token", async () => {
        const client = new HiveClient("my-token", undefined, "https://h.example");
        await client.getModules();

        const init = fetchMock.mock.calls[0][1] as RequestInit;
        expect((init.headers as Record<string, string>).Authorization).toBe(
            "Bearer my-token",
        );
    });
});
