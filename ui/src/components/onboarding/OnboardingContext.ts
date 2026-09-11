"use client";
import { createContext, useContext } from "react";

import { AnchorRegistry } from "@/components/onboarding/core/anchors";
import {
    HelpTopic,
    OnboardingLabels,
    Tour,
    TourEndReason,
    TourStep,
} from "@/components/onboarding/types";

export type OnboardingContextValue = {
    labels: OnboardingLabels;
    /** Live anchor id → element map. Written by `useTourAnchor`. */
    registry: AnchorRegistry;

    /** The running tour, or `null`. */
    activeTour: null | Tour;
    activeStep: null | TourStep;
    activeStepIndex: number;

    startTour: (tourId: string) => void;
    endTour: (reason: TourEndReason) => void;
    goToNextStep: () => void;
    goToPreviousStep: () => void;
    /** `true` while the current step is the last one this run will show. */
    isLastStep: boolean;
    /** `true` while no earlier step is showable. */
    isFirstStep: boolean;
    stepCounter: { current: number; total: number };

    tours: ReadonlyMap<string, Tour>;
    topics: ReadonlyArray<HelpTopic>;
    registerTour: (tour: Tour) => () => void;
    registerTopics: (topics: ReadonlyArray<HelpTopic>) => () => void;

    isTourCompleted: (tourId: string) => boolean;
    /** Forgets a tour's completion, so it auto-starts again. */
    forgetTour: (tourId: string) => void;

    isHelpOpen: boolean;
    openHelp: () => void;
    closeHelp: () => void;
};

export const OnboardingContext = createContext<
    OnboardingContextValue | undefined
>(undefined);

/**
 * Every hook in the package goes through here, so a component used outside the
 * provider fails with one clear message instead of a null dereference deeper in.
 */
export function useOnboardingContext(): OnboardingContextValue {
    const value = useContext(OnboardingContext);

    if (!value) {
        throw new Error(
            "Onboarding hooks must be used inside an <OnboardingProvider>.",
        );
    }

    return value;
}
