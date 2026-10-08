// @ts-expect-error -- react-big-calendar ships no types for its layout algorithms
import overlap from "react-big-calendar/lib/utils/layout-algorithms/overlap";

import { EventSegment } from "@/components/schedule/calendar/split/segments";

/** Geometry react-big-calendar assigns an event within its day column, in percent. */
type SegmentStyle = {
    top: number;
    height: number;
    width: number;
    xOffset: number;
};
type StyledSegment = { event: EventSegment; style: SegmentStyle };
type Accessors = {
    start: (event: EventSegment) => Date;
    end: (event: EventSegment) => Date;
};
type SlotMetrics = {
    getRange: (start: Date, end: Date) => { height: number };
};
type LayoutInput = {
    events: Array<EventSegment>;
    minimumStartDifference: number;
    slotMetrics: SlotMetrics;
    accessors: Accessors;
};

/**
 * Overlap that still counts as back-to-back: events stack at full width only
 * when one ends where the next starts, give or take this much. Anything more
 * shares the column side by side.
 */
export const SLIGHT_OVERLAP_MS = 60 * 1000;

/**
 * Minutes apart two starts must be for react-big-calendar not to force the
 * events side by side. Its default is half a slot group (30 minutes on the
 * schedule), which split back-to-back events such as 9:00–9:15 and 9:15.
 */
export const MINIMUM_START_DIFFERENCE_MIN = 1;

/**
 * For each event that runs at most {@link SLIGHT_OVERLAP_MS} into a later
 * one, the later event's start: where the layout should consider it ended.
 * Starting together is never "slight"; those still share the column.
 */
export function slightOverlapEnds(
    events: Array<EventSegment>,
    accessors: Accessors,
): Map<EventSegment, Date> {
    const clipped = new Map<EventSegment, Date>();
    for (const event of events) {
        const start = +accessors.start(event);
        const end = +accessors.end(event);
        let clipAt = end;
        for (const other of events) {
            const otherStart = +accessors.start(other);
            if (otherStart <= start || otherStart >= end) continue;
            if (end - otherStart > SLIGHT_OVERLAP_MS) continue;
            clipAt = Math.min(clipAt, otherStart);
        }
        if (clipAt < end) clipped.set(event, new Date(clipAt));
    }
    return clipped;
}

/**
 * The built-in `overlap` layout, with the pieces of a split event squared up
 * into a single column band.
 *
 * Left alone, each piece is measured against whatever it collides with on its
 * own: the piece running into a break is narrowed to share the column, while
 * the pieces on the other side have the column to themselves and stay full
 * width. The result is a ragged event that reads as several unrelated blocks.
 *
 * So every piece is given the *intersection* of its run's bands — the widest
 * strip all of them can occupy. Narrowing a piece can never make it collide
 * with anything, since the strip is contained in the band the algorithm
 * already cleared for it.
 */
export function splitAwareDayLayout(input: LayoutInput): Array<StyledSegment> {
    // Back-to-back events (within a minute) stack; only a real overlap shares
    // the column. Clipped tiles get their real height back afterwards.
    const clipped = slightOverlapEnds(input.events, input.accessors);
    const laidOut = overlap({
        ...input,
        minimumStartDifference: MINIMUM_START_DIFFERENCE_MIN,
        ...(clipped.size > 0 && {
            accessors: {
                ...input.accessors,
                end: (event: EventSegment) =>
                    clipped.get(event) ?? input.accessors.end(event),
            },
        }),
    }) as Array<StyledSegment>;
    const styled = clipped.size === 0 ? laidOut : laidOut.map((entry) =>
        clipped.has(entry.event)
            ? {
                ...entry,
                style: {
                    ...entry.style,
                    height: input.slotMetrics.getRange(
                        input.accessors.start(entry.event),
                        input.accessors.end(entry.event),
                    ).height,
                },
            }
            : entry,
    );

    const bandByEvent = new Map<string, { start: number; end: number }>();
    for (const { event: segment, style } of styled) {
        if (segment.count < 2) continue;

        const band = bandByEvent.get(segment.event.id);
        const start = style.xOffset;
        const end = style.xOffset + style.width;
        bandByEvent.set(
            segment.event.id,
            band
                ? { start: Math.max(band.start, start), end: Math.min(band.end, end) }
                : { start, end },
        );
    }

    if (bandByEvent.size === 0) return styled;

    return styled.map((entry) => {
        const band = bandByEvent.get(entry.event.event.id);
        // An empty intersection means the pieces were placed in disjoint
        // columns; there is no shared strip to give them, so leave the
        // algorithm's own placement alone rather than forcing an overlap.
        if (!band || band.end <= band.start) return entry;

        return {
            ...entry,
            style: {
                ...entry.style,
                xOffset: band.start,
                width: band.end - band.start,
            },
        };
    });
}
