// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";

import { AnchorRegistry } from "@/components/onboarding/core/anchors";
import {
    areRectsEqual,
    toPopperPlacement,
    toSpotlightRect,
} from "@/components/onboarding/core/spotlight";
import { findShowableStep, stepProgress } from "@/components/onboarding/core/steps";
import {
    isTourCompleted,
    readCompletions,
    writeCompletions,
} from "@/components/onboarding/core/storage";
import { OnboardingStorage, TourStep } from "@/components/onboarding/types";

/**
 * The onboarding engine's pure half. Everything here is what the overlay
 * *relies* on rather than what it draws: which step comes next, where the
 * cutout lands, and whether a tour has already been seen.
 */

function attach(): HTMLElement {
    const element = document.createElement("div");
    document.body.append(element);
    return element;
}

function fakeStorage(initial: Record<string, string> = {}): OnboardingStorage {
    const store = new Map(Object.entries(initial));
    return {
        read: (key) => store.get(key) ?? null,
        write: (key, value) => void store.set(key, value),
    };
}

const step = (overrides: Partial<TourStep> = {}): TourStep => ({
    id: overrides.id ?? "step",
    title: "כותרת",
    body: "גוף",
    ...overrides,
});

afterEach(() => {
    document.body.innerHTML = "";
});

describe("AnchorRegistry", () => {
    it("resolves a registered element and forgets it on cleanup", () => {
        const registry = new AnchorRegistry();
        const element = attach();

        const unregister = registry.register("a", element);
        expect(registry.get("a")).toBe(element);
        expect(registry.has("a")).toBe(true);

        unregister();
        expect(registry.get("a")).toBeUndefined();
    });

    it("lets the newest mount win, and ignores the older one's cleanup", () => {
        // React mounts the replacement before running the old ref's cleanup, so
        // a naive delete would drop the anchor that is actually on screen.
        const registry = new AnchorRegistry();
        const first = attach();
        const second = attach();

        const unregisterFirst = registry.register("a", first);
        registry.register("a", second);
        unregisterFirst();

        expect(registry.get("a")).toBe(second);
    });

    it("drops an element that was torn out of the document", () => {
        const registry = new AnchorRegistry();
        const element = attach();
        registry.register("a", element);

        element.remove();

        expect(registry.get("a")).toBeUndefined();
    });

    it("notifies subscribers when an anchor appears", () => {
        const registry = new AnchorRegistry();
        let notifications = 0;

        const unsubscribe = registry.subscribe(() => (notifications += 1));
        registry.register("a", attach());
        expect(notifications).toBe(1);

        unsubscribe();
        registry.register("b", attach());
        expect(notifications).toBe(1);
    });
});

describe("step selection", () => {
    const steps = [
        step({ id: "first" }),
        step({ id: "optional-missing", anchor: "ghost", optional: true }),
        step({ id: "last" }),
    ];
    const canShow = (candidate: TourStep) => candidate.anchor === undefined;

    it("skips an optional step whose anchor is nowhere on screen", () => {
        expect(findShowableStep(steps, 0, 1, canShow)).toBe(2);
        expect(findShowableStep(steps, 2, -1, canShow)).toBe(0);
    });

    it("reports running off either end", () => {
        expect(findShowableStep(steps, 2, 1, canShow)).toBeNull();
        expect(findShowableStep(steps, 0, -1, canShow)).toBeNull();
    });

    it("counts only the steps this run will show", () => {
        expect(stepProgress(steps, 0, canShow)).toEqual({ current: 1, total: 2 });
        expect(stepProgress(steps, 2, canShow)).toEqual({ current: 2, total: 2 });
    });
});

describe("spotlight geometry", () => {
    it("grows the anchor's box by the padding", () => {
        const element = attach();
        element.getBoundingClientRect = () =>
            ({ top: 100, left: 200, right: 260, bottom: 140 }) as DOMRect;

        expect(toSpotlightRect(element, 8, { width: 1000, height: 800 })).toEqual({
            top: 92,
            left: 192,
            width: 76,
            height: 56,
        });
    });

    it("clips a partly off-screen anchor to the viewport", () => {
        const element = attach();
        element.getBoundingClientRect = () =>
            ({ top: -20, left: -30, right: 50, bottom: 900 }) as DOMRect;

        expect(toSpotlightRect(element, 4, { width: 400, height: 300 })).toEqual({
            top: 0,
            left: 0,
            width: 54,
            height: 300,
        });
    });

    it("treats sub-pixel movement as no movement", () => {
        const rect = { top: 10, left: 10, width: 100, height: 40 };

        expect(areRectsEqual(rect, { ...rect, top: 10.2 })).toBe(true);
        expect(areRectsEqual(rect, { ...rect, top: 12 })).toBe(false);
        expect(areRectsEqual(null, rect)).toBe(false);
        expect(areRectsEqual(null, null)).toBe(true);
    });

    it("resolves logical placements against the reading direction", () => {
        expect(toPopperPlacement("inline-start", "rtl")).toBe("right");
        expect(toPopperPlacement("inline-start", "ltr")).toBe("left");
        expect(toPopperPlacement("inline-end", "rtl")).toBe("left");
        expect(toPopperPlacement("block-start", "rtl")).toBe("top");
        expect(toPopperPlacement(undefined, "rtl")).toBe("bottom");
    });
});

describe("completion storage", () => {
    it("round-trips completions under the app's namespace", () => {
        const storage = fakeStorage();
        writeCompletions(storage, "bluz", {
            demo: { version: 1, at: "2026-01-01T00:00:00.000Z", reason: "completed" },
        });

        expect(storage.read("bluz:onboarding:completions:v1")).toContain("demo");
        expect(readCompletions(storage, "bluz").demo.reason).toBe("completed");
    });

    it("treats an unreadable store as a first visit", () => {
        expect(readCompletions(fakeStorage(), "bluz")).toEqual({});
        expect(
            readCompletions(
                fakeStorage({ "bluz:onboarding:completions:v1": "{ not json" }),
                "bluz",
            ),
        ).toEqual({});
    });

    it("re-shows a tour whose version was bumped past what was seen", () => {
        const completions = {
            demo: { version: 1, at: "2026-01-01T00:00:00.000Z", reason: "dismissed" as const },
        };

        expect(isTourCompleted(completions, { id: "demo", version: 1 })).toBe(true);
        expect(isTourCompleted(completions, { id: "demo", version: 2 })).toBe(false);
        expect(isTourCompleted(completions, { id: "other", version: 1 })).toBe(false);
    });
});
