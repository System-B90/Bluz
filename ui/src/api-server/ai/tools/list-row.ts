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
