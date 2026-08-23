/**
 * Name: cli-handoff-rate-limit.ts
 * Purpose: Bound guessing attempts against POST /api/cli-auth/redeem. The
 *          codes themselves carry 192 bits of crypto.randomBytes entropy, so
 *          this is defense in depth, not the primary control.
 * Created: 2026-08-22
 * Author: Michael K. Steinberg
 *
 * Same fixed-window, in-memory, per-process shape as ai/rate-limit.ts. Keyed
 * by caller IP rather than a session user — the whole point of this route is
 * that the caller does not have a session yet.
 */

const WINDOW_MS = 60_000;
const MAX_ATTEMPTS_PER_WINDOW = 20;

const hits = new Map<string, Array<number>>();

/** @returns true when the caller is still under the limit (and records the hit). */
export function allowHandoffRedeemAttempt(key: string): boolean {
    const now = Date.now();
    const windowStart = now - WINDOW_MS;
    const previous = hits.get(key) ?? [];
    const recent = previous.filter((timestamp) => timestamp > windowStart);

    if (recent.length >= MAX_ATTEMPTS_PER_WINDOW) {
        hits.set(key, recent);
        return false;
    }

    recent.push(now);
    hits.set(key, recent);
    return true;
}

/**
 * Best-effort caller identity for rate limiting. Behind the app's own nginx
 * (see AGENTS.md) `x-forwarded-for` carries the real client IP; unset in
 * environments without a proxy in front, so every direct caller shares one
 * bucket there rather than the limiter silently doing nothing.
 */
export function rateLimitKeyForRequest(request: Request): string {
    const forwardedFor = request.headers.get("x-forwarded-for");
    if (forwardedFor) {
        return forwardedFor.split(",")[0].trim();
    }
    return "unknown";
}

/** Exists for tests: drops all tracked counters between cases. */
export function resetHandoffRateLimit(): void {
    hits.clear();
}
