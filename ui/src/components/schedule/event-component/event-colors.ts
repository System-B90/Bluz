import { Event, EventType } from "@/components/schedule/types/event";

/**
 * Default background color for Prayer-type events.
 */
export const PRAYER_DEFAULT_COLOR = "#e0f9fe";

/**
 * Resolves the default display color for a calendar event (ignoring per-event overrides).
 * Resolution order: Prayer default → Hive subject color → fallback.
 */
export function resolveEventDefaultColor(
    event: Partial<Event>,
    subject: { color?: string } | undefined,
    fallback: string,
): string {
    return (
        (event.type === EventType.PRAYER ? PRAYER_DEFAULT_COLOR : subject?.color) ??
        fallback
    );
}
