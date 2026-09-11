import { withLabelOverrides } from "@/components/onboarding";
import { HE_LABELS } from "@/components/onboarding/labels/he";

/**
 * Bluz's onboarding wording.
 *
 * Starts from the package's Hebrew table and overrides only what Bluz says
 * differently. Importing `labels/he` and never `labels/en` is what keeps the
 * English strings out of the bundle.
 */
export const ONBOARDING_LABELS = withLabelOverrides(HE_LABELS, {
    done: "יאללה, הבנתי",
    skip: "אולי אחר כך",
    help: {
        title: "עזרה והדרכה",
        openAria: "פתיחת עזרה והדרכה",
        empty: "אין עדיין הסברים למסך הזה. נסו את מסך הגאנט.",
        toursGroup: "הדרכות",
    },
});

/** Section headings in the help panel — centralised so two contributors never
 * spell the same section differently and split it in two. */
export const HELP_GROUPS = {
    gantt: "מסך הגאנט",
    schedule: 'הלו"ז',
} as const;
