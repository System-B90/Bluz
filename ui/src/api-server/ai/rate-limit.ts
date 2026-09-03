/**
 * Basic per-user throttle for `/api/ai/chat`.
 *
 * Each staff session can otherwise open unlimited concurrent turns against a
 * billed upstream model with no accounting. This is a fixed-window counter,
 * not a budget system — it exists to stop accidental or malicious hammering,
 * not to track cost. In-memory and per-process: good enough for a single
 * Next.js server, and resets on deploy.
 */

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

/** Exists for tests: drops all tracked counters between cases. */
export function resetAiRateLimit(): void {
    hits.clear();
}
