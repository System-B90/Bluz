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
    subject: { color?: string; } | undefined,
    fallback: string,
): string
{
    return (
        (event.type === EventType.PRAYER ? PRAYER_DEFAULT_COLOR : subject?.color) ??
        fallback
    );
}

/**
 * Resolves the display color for a calendar event, including per-event overrides.
 * `event.color` stores an ID (a custom color ID or a Hive subject ID), not a hex
 * string, so it must be looked up before use.
 * Resolution order: custom color → Hive subject color (by ID) → default color.
 */
export function resolveEventColor(
    event: Partial<Event>,
    subject: { color?: string; } | undefined,
    lookups: {
        getCustomColor: (id: string) => { hex: string; } | null | undefined;
        getSubject: (id: string) => { color?: string; } | undefined;
    },
    fallback: string,
): string
{
    if (event.color)
    {
        const customColor = lookups.getCustomColor(event.color);
        if (customColor) return customColor.hex;

        const colorSubject = lookups.getSubject(event.color);
        if (colorSubject?.color) return colorSubject.color;
    }

    return resolveEventDefaultColor(event, subject, fallback);
}

/**
 * Resolves a color ID (a custom color ID or a Hive subject ID) to its hex value
 * and display label. Resolution order: custom color → Hive subject.
 */
export function resolveColorById(
    colorId: string,
    lookups: {
        getCustomColor: (id: string) => { hex: string; name: string; } | null | undefined;
        getSubject: (id: string) => { color?: string; displayName?: string; name?: string; } | undefined;
    },
): { hex: string; label: string; } | undefined
{
    const customColor = lookups.getCustomColor(colorId);
    if (customColor) return { hex: customColor.hex, label: customColor.name };

    const subject = lookups.getSubject(colorId);
    if (subject?.color)
    {
        return { hex: subject.color, label: subject.displayName || subject.name || "" };
    }

    return undefined;
}

export const MAX_RECENT_COLORS = 3;

/**
 * Moves `newId` to the front of the recent-colors list, dedupes it, and caps
 * the list at `max` entries.
 */
export function updateRecentColorIds(
    prev: Array<string>,
    newId: string,
    max: number = MAX_RECENT_COLORS,
): Array<string>
{
    const filtered = prev.filter((id) => id !== newId);
    return [ newId, ...filtered ].slice(0, max);
}

/**
 * Filters out swatches whose id is already present in `excludeIds` - used to
 * keep a recently-used color from being listed twice when it's also a
 * subject or custom color shown in its own group.
 */
export function excludeSwatchIds<T extends { id: string; }>(
    swatches: Array<T>,
    excludeIds: Iterable<string>,
): Array<T>
{
    const exclude = new Set(excludeIds);
    return swatches.filter((swatch) => !exclude.has(swatch.id));
}
