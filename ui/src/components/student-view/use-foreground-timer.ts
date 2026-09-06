"use client";

import { useEffect } from "react";

import { ENGAGEMENT_FLUSH_INTERVAL_MS } from "@/api-shared/types/student-view";

const ENGAGEMENT_URL = "/api/student-view/engagement";

/** Open *and* focused — a background tab and an unfocused window both stop it. */
function isForeground(): boolean {
    return document.visibilityState === "visible" && document.hasFocus();
}

/**
 * Reports accumulated time, preferring `sendBeacon` so the final flush survives
 * the tab closing (a `fetch` started in `pagehide` is routinely cancelled).
 */
function report(seconds: number): void {
    if (seconds <= 0) return;
    const body = JSON.stringify({ seconds });

    if (navigator.sendBeacon) {
        // Beacons are same-origin and carry the session cookie, so the server
        // still attributes the report to the session, never to the payload.
        navigator.sendBeacon(
            ENGAGEMENT_URL,
            new Blob([body], { type: "application/json" }),
        );
        return;
    }
    void fetch(ENGAGEMENT_URL, {
        body,
        headers: { "Content-Type": "application/json" },
        keepalive: true,
        method: "POST",
    }).catch(() => {
        // Losing a heartbeat is not worth surfacing to a student.
    });
}

/**
 * Counts the time this page spends open and in the foreground, flushing it to
 * the server on a heartbeat and whenever the page stops being foreground
 * (#656).
 *
 * Time is measured as wall-clock deltas between foreground transitions rather
 * than by counting ticks, so a throttled background timer cannot under- or
 * over-count: a hidden tab's interval simply has nothing to add.
 */
export function useForegroundTimer(): void {
    useEffect(() => {
        // Milliseconds banked from completed foreground stretches, plus when
        // the current stretch began (null while not in the foreground).
        let banked = 0;
        let since: null | number = isForeground() ? Date.now() : null;

        const bank = () => {
            if (since === null) return;
            banked += Date.now() - since;
            since = null;
        };

        const flush = () => {
            const seconds = Math.floor(banked / 1000);
            if (seconds <= 0) return;
            // Keep the sub-second remainder so a slow drip still accumulates
            // instead of being rounded away on every flush.
            banked -= seconds * 1000;
            report(seconds);
        };

        const onVisibilityChange = () => {
            if (isForeground()) {
                since ??= Date.now();
                return;
            }
            // Leaving the foreground is the most reliable moment to record:
            // on mobile, `pagehide` may be the last callback that ever runs.
            bank();
            flush();
        };

        const onPageHide = () => {
            bank();
            flush();
        };

        const heartbeat = setInterval(() => {
            // Close the open stretch, flush, and reopen it, so a tab left
            // focused for hours still reports along the way.
            bank();
            flush();
            if (isForeground()) since = Date.now();
        }, ENGAGEMENT_FLUSH_INTERVAL_MS);

        document.addEventListener("visibilitychange", onVisibilityChange);
        window.addEventListener("blur", onVisibilityChange);
        window.addEventListener("focus", onVisibilityChange);
        window.addEventListener("pagehide", onPageHide);

        return () => {
            clearInterval(heartbeat);
            document.removeEventListener("visibilitychange", onVisibilityChange);
            window.removeEventListener("blur", onVisibilityChange);
            window.removeEventListener("focus", onVisibilityChange);
            window.removeEventListener("pagehide", onPageHide);
            onPageHide();
        };
    }, []);
}
