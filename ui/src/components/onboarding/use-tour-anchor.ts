"use client";
import { useCallback } from "react";

import { useOnboardingContext } from "@/components/onboarding/OnboardingContext";
import { TourAnchorId } from "@/components/onboarding/types";

/**
 * Marks an element as a spotlight target.
 *
 * ```tsx
 * <Tabs ref={useTourAnchor("gantt.tabs")} />
 * ```
 *
 * The returned ref callback registers on mount and un-registers on unmount, so
 * a tour always spotlights whatever is on screen right now — and a component
 * that is never rendered simply has no anchor, which is what lets steps be
 * marked `optional` and skipped.
 */
export function useTourAnchor<T extends HTMLElement = HTMLElement>(
    id: TourAnchorId,
): (element: null | T) => (() => void) | undefined {
    const { registry } = useOnboardingContext();

    return useCallback(
        (element: null | T) => {
            if (!element) return undefined;
            return registry.register(id, element);
        },
        [id, registry],
    );
}
