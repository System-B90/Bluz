import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The self-test runs against the provider chat would use for the caller:
 * their personal token when set, else the server key (#783).
 */

const mocks = vi.hoisted(() => ({
    getAiProvider: vi.fn((_key?: string) => ({ name: "fake", defaultModel: "m" })),
    startBenchmarkJob: vi.fn(() => ({ job: { status: "running" }, started: true })),
    personalToken: { value: "" },
}));

vi.mock("@/api-server/session-user", () => ({
    requireStaffSession: vi.fn(async () => ({ id: 7, display_name: "מיכאל" })),
}));
vi.mock("@/api-server/ai", () => ({ getAiProvider: mocks.getAiProvider, isAiConfigured: () => true }));
vi.mock("@/api-server/ai/benchmark/job", () => ({
    getBenchmarkJob: vi.fn(() => ({ status: "idle" })),
    startBenchmarkJob: mocks.startBenchmarkJob,
}));
vi.mock("@/api-server/db-personal-settings", () => ({
    DbPersonalSettings: {
        get: vi.fn(async () => ({ aiApiToken: mocks.personalToken.value })),
    },
}));

import { POST } from "@/app/api/ai/benchmark/route";
import { resetAiRateLimit } from "@/api-server/ai/rate-limit";

const post = () =>
    POST(new Request("https://bluz.test/api/ai/benchmark", { method: "POST" }));

beforeEach(() => {
    vi.clearAllMocks();
    resetAiRateLimit();
    mocks.personalToken.value = "";
});

describe("POST /api/ai/benchmark", () => {
    it("uses the caller's personal API token when set", async () => {
        mocks.personalToken.value = "sk-personal";
        await post();
        expect(mocks.getAiProvider).toHaveBeenCalledWith("sk-personal");
    });

    it("falls back to the server key without a personal token", async () => {
        await post();
        expect(mocks.getAiProvider).toHaveBeenCalledWith(undefined);
    });
});
