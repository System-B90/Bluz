import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Per-user throttles for the assistant.
 *
 * Chat and the self-test are counted separately on purpose: one self-test run
 * drives several complete agent turns, so sharing the chat budget would let a
 * user spend an afternoon of tokens by clicking one button twice.
 */

import {
    aiBenchmarkCooldownMs,
    allowAiBenchmark,
    allowAiRequest,
    resetAiRateLimit,
} from "@/api-server/ai/rate-limit";
import { AI_BENCHMARK_WINDOW_MS } from "@/api-shared/types/ai-benchmark";

beforeEach(() => {
    resetAiRateLimit();
    vi.useFakeTimers();
});

afterEach(() => {
    vi.useRealTimers();
    resetAiRateLimit();
});

describe("allowAiBenchmark", () => {
    it("allows one run and then refuses until the window passes", () => {
        expect(allowAiBenchmark("u1")).toBe(true);
        expect(allowAiBenchmark("u1")).toBe(false);

        vi.advanceTimersByTime(AI_BENCHMARK_WINDOW_MS);
        expect(allowAiBenchmark("u1")).toBe(true);
    });

    it("counts each user separately", () => {
        expect(allowAiBenchmark("u1")).toBe(true);
        expect(allowAiBenchmark("u2")).toBe(true);
    });

    it("reports how long is left, so the message can say it", () => {
        allowAiBenchmark("u1");
        vi.advanceTimersByTime(AI_BENCHMARK_WINDOW_MS / 2);

        const remaining = aiBenchmarkCooldownMs("u1");
        expect(remaining).toBeGreaterThan(0);
        expect(remaining).toBeLessThanOrEqual(AI_BENCHMARK_WINDOW_MS / 2);
        expect(aiBenchmarkCooldownMs("never-ran")).toBe(0);
    });

    it("does not share a budget with ordinary chat", () => {
        // Burning the chat allowance must not lock a user out of verifying
        // their model, and vice versa.
        for (let index = 0; index < 12; index++) allowAiRequest("u1");
        expect(allowAiRequest("u1")).toBe(false);

        expect(allowAiBenchmark("u1")).toBe(true);
    });
});
