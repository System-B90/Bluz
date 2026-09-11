import { OnboardingLabels } from "@/components/onboarding/types";

/** English copy. Import this table *or* `he`, never both — see the README. */
export const EN_LABELS: OnboardingLabels = {
    next: "Next",
    back: "Back",
    skip: "Skip",
    done: "Got it",
    stepCounter: (current, total) => `${current} of ${total}`,
    closeTourAria: "Close the tour",
    interactiveHint: "You can try it now — the tour will wait.",
    help: {
        title: "Help",
        openAria: "Open help",
        close: "Close",
        replayTour: "Replay the tour",
        empty: "There is nothing to explain on this screen yet.",
        emptyHint: "Open a screen with a guide, or replay one from here.",
        toursGroup: "Guided tours",
    },
};
