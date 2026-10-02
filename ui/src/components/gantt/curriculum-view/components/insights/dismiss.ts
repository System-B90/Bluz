/**
 * Session-scoped "dismiss for an hour" for the gantt insights card (#854).
 *
 * Browser-only, no DB: one timestamp in `sessionStorage`. Another tab or a new
 * session shows the card again, which is fine for a QoL toggle.
 */

export const INSIGHTS_DISMISS_KEY = "bluz.gantt.insights.dismissedUntil";
export const INSIGHTS_DISMISS_MS = 60 * 60 * 1000;

function storage(): null | Storage {
    try {
        return typeof window === "undefined" ? null : window.sessionStorage;
    } catch {
        return null;
    }
}

/** Epoch ms until which the card stays hidden, or null when it is not dismissed. */
export function readInsightsDismissedUntil(now = Date.now()): null | number {
    try {
        const raw = storage()?.getItem(INSIGHTS_DISMISS_KEY);
        const until = raw ? Number(raw) : NaN;
        return Number.isFinite(until) && until > now ? until : null;
    } catch {
        return null;
    }
}

/** Hides the card for {@link INSIGHTS_DISMISS_MS}; returns the expiry. */
export function dismissInsights(now = Date.now()): number {
    const until = now + INSIGHTS_DISMISS_MS;
    try {
        storage()?.setItem(INSIGHTS_DISMISS_KEY, String(until));
    } catch {
        // Storage blocked: the dismiss still holds for this render via state.
    }
    return until;
}
