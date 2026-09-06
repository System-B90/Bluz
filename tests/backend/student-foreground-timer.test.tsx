// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/*
 * The focused-time counter (#656). What is asserted here is that it counts
 * *foreground* time only — a hidden tab or an unfocused window must not
 * accumulate — and that the last stretch is reported when the page goes away,
 * which is the report most likely to be lost.
 */

import { ENGAGEMENT_FLUSH_INTERVAL_MS } from "@/api-shared/types/student-view";
import { useForegroundTimer } from "@/components/student-view/use-foreground-timer";

function Harness() {
    useForegroundTimer();
    return null;
}

let sendBeacon: ReturnType<typeof vi.fn>;
let visibility: DocumentVisibilityState;
let focused: boolean;

/*
 * jsdom's Blob has no `.text()`, so the payload cannot be read back from a
 * real one. A recording stand-in keeps the hook shipping a proper Blob (which
 * is what `sendBeacon` needs in a browser) while letting the test read it.
 */
class RecordingBlob {
    public readonly body: string;
    constructor(parts: Array<string>) {
        this.body = parts.join("");
    }
}

/** The JSON bodies handed to `sendBeacon`, in order. */
function bodies(): Array<Record<string, unknown>> {
    return sendBeacon.mock.calls.map(([, blob]) =>
        JSON.parse((blob as RecordingBlob).body),
    );
}

/** Reported second-counts, in order. */
function reported(): Array<number> {
    return bodies().map((body) => body.seconds as number);
}

function setForeground(next: boolean) {
    visibility = next ? "visible" : "hidden";
    focused = next;
    document.dispatchEvent(new Event("visibilitychange"));
}

beforeEach(() => {
    vi.useFakeTimers();
    visibility = "visible";
    focused = true;

    vi.stubGlobal("Blob", RecordingBlob);
    sendBeacon = vi.fn(() => true);
    Object.defineProperty(navigator, "sendBeacon", {
        configurable: true,
        value: sendBeacon,
    });
    Object.defineProperty(document, "visibilityState", {
        configurable: true,
        get: () => visibility,
    });
    vi.spyOn(document, "hasFocus").mockImplementation(() => focused);
});

afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe("useForegroundTimer", () => {
    it("reports the elapsed time on each heartbeat while focused", async () => {
        render(<Harness />);

        await vi.advanceTimersByTimeAsync(ENGAGEMENT_FLUSH_INTERVAL_MS);

        expect(reported()).toEqual([ENGAGEMENT_FLUSH_INTERVAL_MS / 1000]);
    });

    it("counts nothing while the tab is hidden", async () => {
        render(<Harness />);

        setForeground(false);
        sendBeacon.mockClear();

        await vi.advanceTimersByTimeAsync(ENGAGEMENT_FLUSH_INTERVAL_MS * 3);

        expect(sendBeacon).not.toHaveBeenCalled();
    });

    it("counts nothing while the window is merely unfocused", async () => {
        render(<Harness />);

        // Still "visible", but the user is in another window.
        focused = false;
        window.dispatchEvent(new Event("blur"));
        sendBeacon.mockClear();

        await vi.advanceTimersByTimeAsync(ENGAGEMENT_FLUSH_INTERVAL_MS * 2);

        expect(sendBeacon).not.toHaveBeenCalled();
    });

    it("banks the open stretch the moment the tab is hidden", async () => {
        render(<Harness />);

        await vi.advanceTimersByTimeAsync(5_000);
        setForeground(false);

        expect(reported()).toEqual([5]);
    });

    it("resumes counting when the tab comes back", async () => {
        render(<Harness />);

        await vi.advanceTimersByTimeAsync(5_000);
        setForeground(false);
        await vi.advanceTimersByTimeAsync(60_000);
        setForeground(true);
        await vi.advanceTimersByTimeAsync(7_000);
        setForeground(false);

        // The 60s spent hidden are not in either report.
        expect(reported()).toEqual([5, 7]);
    });

    it("flushes the final stretch on pagehide", async () => {
        render(<Harness />);

        await vi.advanceTimersByTimeAsync(9_000);
        window.dispatchEvent(new Event("pagehide"));

        expect(reported()).toEqual([9]);
    });

    it("reports nothing for a sub-second stretch, keeping the remainder", async () => {
        render(<Harness />);

        await vi.advanceTimersByTimeAsync(400);
        window.dispatchEvent(new Event("pagehide"));

        expect(sendBeacon).not.toHaveBeenCalled();
    });

    it("attributes nothing itself — the body carries only a duration", async () => {
        render(<Harness />);

        await vi.advanceTimersByTimeAsync(ENGAGEMENT_FLUSH_INTERVAL_MS);

        expect(Object.keys(bodies()[0])).toEqual(["seconds"]);
    });
});
