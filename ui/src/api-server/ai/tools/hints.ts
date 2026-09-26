/**
 * Per-result guidance shared by production tools and their benchmark twins,
 * so the self-test model reads exactly what the real one does.
 */

/** An iteration whose id or label says "current" is just a name. */
export const ITERATION_HINTS = [
    "המחזור הנוכחי הוא זה עם isCurrent=true, בלי קשר ל-id או לשם.",
];

export const CURRICULUM_HINTS = [
    'הגאנט הוא תוכנית. לשאלה על מה שקורה בפועל (מי מבזר, מה קורה השבוע) — list_events.',
    "orchestratorId = אחראי, leadInstructorIds = אחראי מקצוע. אלה תכנון, לא נוכחות. שמות — list_people.",
];

export function weekHints(hasDates: boolean): Array<string> {
    return [
        'שבוע גאנט הוא תכנון. מה שקורה בפועל בתאריכים from–to נמצא בלו"ז (list_events).',
        ...(hasDates ? [] : ["לגאנט אין startDate, ולכן אין לשבועות תאריכים."]),
    ];
}
