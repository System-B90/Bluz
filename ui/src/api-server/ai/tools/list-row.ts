/**
 * Column selection for list_events rows. Lives apart from `calendar.ts` so
 * the benchmark fixture can share it while tests mock `calendar.ts` away.
 */

import type { AiEventSummary } from "@/api-server/ai/tools/calendar";

/** Columns every list row carries: enough to name an event and say when. */
const LIST_BASE_FIELDS = ["id", "name", "startTime", "endTime"] as const;

/** Columns the model may ask list_events for; get_event returns all of them. */
export const LIST_EXTRA_FIELDS = [
    "type", "rooms", "courses", "instructors", "lecturers",
    "locked", "hidden", "fake", "color", "notes",
] as const;

export type ListExtraField = (typeof LIST_EXTRA_FIELDS)[number];

/** Per-result guidance for list_events; the people rules only when people show. */
export function listEventsHints(
    events: Array<AiEventSummary>,
    fields: Array<ListExtraField>,
): Array<string> {
    const showsPeople = (fields.includes("instructors") || fields.includes("lecturers")) &&
        events.some((event) => event.instructors.length || event.lecturers?.length);
    return [
        "שדה חסר = ריק או false. לשדות נוספים — fields, לאירוע מלא — get_event.",
        ...(showsPeople
            ? [
                "instructors = מבוזרים. lecturers = מרצים. אלה מזהי הייב — שמות דרך list_people.",
                "מרצה שהוא מדריך נחשב גם מבזר, אלא אם לאירוע יש מבזר אחר. איש חוץ לעולם אינו מבזר.",
            ]
            : []),
    ];
}

/** Drops events without an instructor or lecturer, for `withPeople`. */
export const hasPeople = (event: AiEventSummary) =>
    event.instructors.length > 0 || (event.lecturers?.length ?? 0) > 0;

/**
 * One list row: the base columns plus the requested extras, minus empty
 * values. A week of meals would otherwise repeat the same `[]` and `false`
 * per row and crowd the real rows out of the result cap.
 */
export function listRow(
    summary: AiEventSummary,
    fields: Array<ListExtraField>,
): Partial<AiEventSummary> {
    return Object.fromEntries(
        [...LIST_BASE_FIELDS, ...fields]
            .map((key) => [key, summary[key]] as const)
            .filter(([, value]) =>
                !(value === undefined || value === false || value === null ||
                    value === "" || (Array.isArray(value) && value.length === 0))),
    );
}
