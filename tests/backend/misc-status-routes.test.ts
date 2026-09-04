import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/api-server/hive/health", () => ({ isHiveReachable: vi.fn() }));
vi.mock("@/api-server/db-iterations", () => ({
    DbIterations: { get: vi.fn(), current: vi.fn(), usage: vi.fn() },
}));
vi.mock("@/api-server/ai", () => ({ isAiConfigured: vi.fn(() => true) }));
vi.mock("@/api-server/ai/tools", () => ({ toolSummaries: vi.fn(() => []) }));
vi.mock("@/api-server/session-user", () => ({
    requireStaffSession: vi.fn(async () => undefined),
    getSessionUser: vi.fn(async () => ({ id: "u1" })),
}));

import { isAiConfigured } from "@/api-server/ai";
import { toolSummaries } from "@/api-server/ai/tools";
import { DbIterations } from "@/api-server/db-iterations";
import { isHiveReachable } from "@/api-server/hive/health";
import { requireStaffSession } from "@/api-server/session-user";
import * as AiToolsRoute from "@/app/api/ai/tools/route";
import * as HiveStatusRoute from "@/app/api/auth/hive-status/route";
import * as CurrentUsageRoute from "@/app/api/iterations/current/usage/route";

const anyRequest = new Request("http://localhost/api/x");

beforeEach(() => vi.clearAllMocks());

describe("GET /api/auth/hive-status", () => {
    it("reports Hive as reachable", async () => {
        vi.mocked(isHiveReachable).mockResolvedValueOnce(true);

        const response = await HiveStatusRoute.GET();

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ reachable: true });
    });

    it("reports an outage as a 200 with reachable:false, not an error", async () => {
        vi.mocked(isHiveReachable).mockResolvedValueOnce(false);

        const response = await HiveStatusRoute.GET();

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ reachable: false });
    });
});

describe("GET /api/iterations/current/usage", () => {
    it("prefers a migrated iteration whose literal id is 'current'", async () => {
        vi.mocked(DbIterations.get).mockResolvedValueOnce({
            id: "current",
        } as never);
        vi.mocked(DbIterations.usage).mockResolvedValueOnce({
            events: 3,
        } as never);

        const response = await CurrentUsageRoute.GET(
            anyRequest,
            undefined as never,
        );

        expect(response.status).toBe(200);
        expect(DbIterations.current).not.toHaveBeenCalled();
        expect(DbIterations.usage).toHaveBeenCalledWith("current");
    });

    it("falls back to the active iteration when no such literal exists", async () => {
        vi.mocked(DbIterations.get).mockResolvedValueOnce(
            undefined as never,
        );
        vi.mocked(DbIterations.current).mockResolvedValueOnce({
            id: "2026-a",
        } as never);
        vi.mocked(DbIterations.usage).mockResolvedValueOnce({} as never);

        await CurrentUsageRoute.GET(anyRequest, undefined as never);

        expect(DbIterations.usage).toHaveBeenCalledWith("2026-a");
    });

    it("requires a staff session", async () => {
        vi.mocked(requireStaffSession).mockRejectedValueOnce(
            new Error("nope"),
        );

        const response = await CurrentUsageRoute.GET(
            anyRequest,
            undefined as never,
        );

        expect(response.status).toBeGreaterThanOrEqual(400);
        expect(DbIterations.usage).not.toHaveBeenCalled();
    });
});

describe("GET /api/ai/tools", () => {
    it("reports the tool summaries alongside the enabled flag", async () => {
        vi.mocked(toolSummaries).mockReturnValueOnce([
            { name: "createEvent" },
        ] as never);

        const response = await AiToolsRoute.GET(anyRequest, undefined as never);

        expect(response.status).toBe(200);
        expect((await response.json()).data).toEqual({
            enabled: true,
            tools: [ { name: "createEvent" } ],
        });
    });

    it("reports enabled:false on a deployment with no key, so the UI can hide the launcher", async () => {
        vi.mocked(isAiConfigured).mockReturnValueOnce(false);

        const { data } = await (
            await AiToolsRoute.GET(anyRequest, undefined as never)
        ).json();

        expect(data.enabled).toBe(false);
    });
});
