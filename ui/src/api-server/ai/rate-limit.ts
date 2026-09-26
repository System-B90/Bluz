/**
 * Basic per-user throttle for `/api/ai/chat`.
 *
 * Each staff session can otherwise open unlimited concurrent turns against a
 * billed upstream model with no accounting. This is a fixed-window counter,
 * not a budget system — it exists to stop accidental or malicious hammering,
 * not to track cost. In-memory and per-process: good enough for a single
 * Next.js server, and resets on deploy.
 */

import { AI_BENCHMARK_WINDOW_MS } from "@/api-shared/types/ai-benchmark";

const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 12;

const hits = new Map<string, Array<number>>();

/** @returns true when the caller is still under the limit (and records the hit). */
export function allowAiRequest(userId: string): boolean {
    const now = Date.now();
    const windowStart = now - WINDOW_MS;
    const previous = hits.get(userId) ?? [];
    const recent = previous.filter((timestamp) => timestamp > windowStart);

    if (recent.length >= MAX_REQUESTS_PER_WINDOW) {
        hits.set(userId, recent);
        return false;
    }

    recent.push(now);
    hits.set(userId, recent);

    // Sweep stale entries here rather than on a timer: a user who stops
    // chatting would otherwise leave a Map entry for the process lifetime.
    for (const [id, timestamps] of hits) {
        if (timestamps.every((timestamp) => timestamp <= windowStart)) {
            hits.delete(id);
        }
    }

    return true;
}

/**
 * Separate, far stricter throttle for the self-test.
 *
 * One run drives several complete agent turns against a billed model, so it
 * costs roughly an afternoon of chat. Sharing the chat counter would let a
 * user spend that budget by accident, repeatedly, from a button.
 */
const benchmarkRuns = new Map<string, number>();

/** @returns true when this user may start a run now (and records it). */
export function allowAiBenchmark(userId: string): boolean {
    // Dev iterates on prompts and tools; a cooldown there only gets in the way.
    if (process.env.NODE_ENV === "development") return true;
    const now = Date.now();
    const last = benchmarkRuns.get(userId);
    if (last !== undefined && now - last < AI_BENCHMARK_WINDOW_MS) return false;

    benchmarkRuns.set(userId, now);
    for (const [id, timestamp] of benchmarkRuns) {
        if (now - timestamp >= AI_BENCHMARK_WINDOW_MS) benchmarkRuns.delete(id);
    }
    return true;
}

/** How long until this user may run the self-test again, in ms. */
export function aiBenchmarkCooldownMs(userId: string): number {
    const last = benchmarkRuns.get(userId);
    if (last === undefined) return 0;
    return Math.max(0, AI_BENCHMARK_WINDOW_MS - (Date.now() - last));
}

/** Exists for tests: drops all tracked counters between cases. */
export function resetAiRateLimit(): void {
    hits.clear();
    benchmarkRuns.clear();
}
