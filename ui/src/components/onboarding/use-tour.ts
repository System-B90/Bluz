"use client";
import { useEffect } from "react";

import { useOnboardingContext } from "@/components/onboarding/OnboardingContext";
import { Tour } from "@/components/onboarding/types";

/**
 * Contributes a tour from the component that owns the screen it describes, so
 * the tour is registered exactly while that screen is mounted.
 *
 * `tour` must be referentially stable — a module constant, or `useMemo` with
 * the callbacks its steps close over. A fresh object every render re-registers
 * the tour every render.
 */
export function useTour(tour: Tour): void {
    const { registerTour } = useOnboardingContext();

    useEffect(() => registerTour(tour), [registerTour, tour]);
}
