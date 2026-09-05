"use client";
import { useOnboardingContext } from "@/components/onboarding/OnboardingContext";
import {
    HelpTopic,
    OnboardingLabels,
    Tour,
    TourEndReason,
} from "@/components/onboarding/types";

export type UseOnboarding = {
    labels: OnboardingLabels;
    activeTour: null | Tour;
    tours: ReadonlyMap<string, Tour>;
    topics: ReadonlyArray<HelpTopic>;
    startTour: (tourId: string) => void;
    endTour: (reason: TourEndReason) => void;
    isTourCompleted: (tourId: string) => boolean;
    forgetTour: (tourId: string) => void;
    isHelpOpen: boolean;
    openHelp: () => void;
    closeHelp: () => void;
};

/**
 * The consumer-facing slice of the onboarding state: start or replay a tour,
 * open the help panel, ask whether a tour has already been seen.
 */
export function useOnboarding(): UseOnboarding {
    const {
        activeTour,
        closeHelp,
        endTour,
        forgetTour,
        isHelpOpen,
        isTourCompleted,
        labels,
        openHelp,
        startTour,
        topics,
        tours,
    } = useOnboardingContext();

    return {
        labels,
        activeTour,
        tours,
        topics,
        startTour,
        endTour,
        isTourCompleted,
        forgetTour,
        isHelpOpen,
        openHelp,
        closeHelp,
    };
}
