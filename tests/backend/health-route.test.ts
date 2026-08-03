import { beforeEach, describe, expect, it, vi } from "vitest";

const pingMock = vi.fn();
const executeMock = vi.fn();
const hiveReachableMock = vi.fn();

vi.mock("@/api-server/mongo-db-controller", () => ({
    databaseController: {
        client: { db: () => ({ command: pingMock }) },
    },
}));

vi.mock("@/api-server/gantt", () => ({
    postgresDb: { execute: (...args: Array<unknown>) => executeMock(...args) },
}));

vi.mock("@/api-server/hive/health", () => ({
    isHiveReachable: () => hiveReachableMock(),
}));

import * as HealthRoute from "@/app/api/health/route";

beforeEach(() => {
    vi.clearAllMocks();
    pingMock.mockResolvedValue({ ok: 1 });
    executeMock.mockResolvedValue([]);
    hiveReachableMock.mockResolvedValue(true);
});

describe("GET /api/health", () => {
    it("reports healthy with 200 when every dependency is up", async () => {
        const response = await HealthRoute.GET();

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({
            status: "healthy",
            checks: { mongodb: "up", postgres: "up", hive: "up" },
        });
    });

    it("reports degraded but still 200 when only Hive is down", async () => {
        hiveReachableMock.mockResolvedValue(false);

        const response = await HealthRoute.GET();

        // The load balancer must keep routing: Bluz itself is serving.
        expect(response.status).toBe(200);
        const json = await response.json();
        expect(json.status).toBe("degraded");
        expect(json.checks.hive).toBe("degraded");
    });

    it.each([
        ["mongodb", () => pingMock.mockRejectedValue(new Error("no mongo"))],
        ["postgres", () => executeMock.mockRejectedValue(new Error("no pg"))],
    ])("reports unhealthy with 503 when %s is down", async (name, fail) => {
        fail();

        const response = await HealthRoute.GET();

        expect(response.status).toBe(503);
        const json = await response.json();
        expect(json.status).toBe("unhealthy");
        expect(json.checks[name]).toBe("down");
    });

    it("leaks no infrastructure detail on failure", async () => {
        executeMock.mockRejectedValue(
            new Error("connect ECONNREFUSED 10.0.0.5:5432"),
        );

        const body = await (await HealthRoute.GET()).text();

        expect(body).not.toContain("ECONNREFUSED");
        expect(body).not.toContain("5432");
    });
});

describe("health check timeouts", () => {
    it("does not leave an unhandled rejection when a probe loses the race", async () => {
        // The probe rejecting *after* the timeout already won is what crashed
        // the server: Node throws on an unhandled rejection, so the container
        // restart-looped whenever a database was briefly slow.
        const unhandled: Array<unknown> = [];
        const onUnhandled = (reason: unknown) => unhandled.push(reason);
        process.on("unhandledRejection", onUnhandled);

        // Must outlast the 2.5s per-check budget: the point is a probe that
        // rejects once the timeout has already decided the result.
        executeMock.mockImplementation(
            () =>
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error("slow then failed")), 2_700),
                ),
        );

        try {
            const response = await HealthRoute.GET();
            expect(response.status).toBe(503);

            // Give the late rejection a turn to surface.
            await new Promise((resolve) => setTimeout(resolve, 500));
            expect(unhandled).toEqual([]);
        } finally {
            process.off("unhandledRejection", onUnhandled);
        }
    }, 10_000);
});
