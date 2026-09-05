import { OnboardingLabels } from "@/components/onboarding/types";

/** Hebrew copy. Import this table *or* `en`, never both — see the README. */
export const HE_LABELS: OnboardingLabels = {
    next: "הבא",
    back: "הקודם",
    skip: "דילוג",
    done: "הבנתי",
    stepCounter: (current, total) => `${current} מתוך ${total}`,
    closeTourAria: "סגירת ההדרכה",
    help: {
        title: "עזרה",
        openAria: "פתיחת חלונית העזרה",
        close: "סגירה",
        replayTour: "הרצת ההדרכה מחדש",
        empty: "אין עדיין הסברים למסך הזה.",
        toursGroup: "הדרכות מודרכות",
    },
};
