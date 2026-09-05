import { TourPlacement } from "@/components/onboarding/types";

export type SpotlightRect = {
    top: number;
    left: number;
    width: number;
    height: number;
};

export const DEFAULT_SPOTLIGHT_PADDING = 8;

/**
 * The anchor's viewport box, grown by `padding` and clipped to the viewport so
 * a partially off-screen anchor still produces a cutout that is on screen.
 */
export function toSpotlightRect(
    element: HTMLElement,
    padding: number,
    viewport: { width: number; height: number },
): SpotlightRect {
    const box = element.getBoundingClientRect();

    const top = Math.max(0, box.top - padding);
    const left = Math.max(0, box.left - padding);
    const right = Math.min(viewport.width, box.right + padding);
    const bottom = Math.min(viewport.height, box.bottom + padding);

    return {
        top,
        left,
        width: Math.max(0, right - left),
        height: Math.max(0, bottom - top),
    };
}

export function areRectsEqual(
    a: null | SpotlightRect,
    b: null | SpotlightRect,
): boolean {
    if (a === null || b === null) return a === b;

    return (
        Math.abs(a.top - b.top) < 0.5 &&
        Math.abs(a.left - b.left) < 0.5 &&
        Math.abs(a.width - b.width) < 0.5 &&
        Math.abs(a.height - b.height) < 0.5
    );
}

/**
 * Resolves a logical placement against the document's direction. Popper speaks
 * physical sides only, and letting it flip `start`/`end` itself would fight the
 * app's own RTL handling.
 */
export function toPopperPlacement(
    placement: TourPlacement | undefined,
    direction: "ltr" | "rtl",
): "bottom" | "left" | "right" | "top" {
    switch (placement) {
    case "block-start":
        return "top";
    case "inline-start":
        return direction === "rtl" ? "right" : "left";
    case "inline-end":
        return direction === "rtl" ? "left" : "right";
    default:
        return "bottom";
    }
}
