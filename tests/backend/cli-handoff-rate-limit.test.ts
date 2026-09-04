import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
    allowHandoffRedeemAttempt,
    rateLimitKeyForRequest,
    resetHandoffRateLimit,
} from "@/api-server/cli-handoff-rate-limit";

/**
 * Defense in depth for POST /api/cli-auth/redeem: a fixed 60s window of 20
 * attempts per caller. The window's *sliding* edge is the part a rewrite gets
 * wrong, so it is exercised with a fake clock rather than by waiting.
 */
const MAX = 20;

describe("allowHandoffRedeemAttempt", () => {
    beforeEach(() => {
        resetHandoffRateLimit();
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-03-01T08:00:00.000Z"));
    });
    afterEach(() => vi.useRealTimers());

    it("allows exactly the first 20 attempts, then blocks", () => {
        for (let i = 0; i < MAX; i++) {
            expect(allowHandoffRedeemAttempt("1.2.3.4")).toBe(true);
        }

        expect(allowHandoffRedeemAttempt("1.2.3.4")).toBe(false);
    });

    it("does not count a blocked attempt against the next window", () => {
        for (let i = 0; i < MAX + 5; i++) {
            allowHandoffRedeemAttempt("1.2.3.4");
        }

        vi.advanceTimersByTime(60_001);

        expect(allowHandoffRedeemAttempt("1.2.3.4")).toBe(true);
    });

    it("frees one slot as the oldest attempt ages out", () => {
        allowHandoffRedeemAttempt("1.2.3.4");
        vi.advanceTimersByTime(30_000);
        for (let i = 1; i < MAX; i++) allowHandoffRedeemAttempt("1.2.3.4");

        expect(allowHandoffRedeemAttempt("1.2.3.4")).toBe(false);

        // The very first hit passes out of the window; one slot opens.
        vi.advanceTimersByTime(30_001);
        expect(allowHandoffRedeemAttempt("1.2.3.4")).toBe(true);
        expect(allowHandoffRedeemAttempt("1.2.3.4")).toBe(false);
    });

    it("keeps separate buckets per caller", () => {
        for (let i = 0; i < MAX; i++) allowHandoffRedeemAttempt("1.2.3.4");

        expect(allowHandoffRedeemAttempt("1.2.3.4")).toBe(false);
        expect(allowHandoffRedeemAttempt("5.6.7.8")).toBe(true);
    });
});

describe("rateLimitKeyForRequest", () => {
    it("uses the first hop of x-forwarded-for", () => {
        const request = new Request("http://localhost/api/cli-auth/redeem", {
            headers: { "x-forwarded-for": " 1.2.3.4 , 10.0.0.1 " },
        });

        expect(rateLimitKeyForRequest(request)).toBe("1.2.3.4");
    });

    it("falls back to one shared bucket with no proxy in front", () => {
        const request = new Request("http://localhost/api/cli-auth/redeem");

        expect(rateLimitKeyForRequest(request)).toBe("unknown");
    });
});
