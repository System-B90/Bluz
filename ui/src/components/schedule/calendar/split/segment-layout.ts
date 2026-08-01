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
type LayoutInput = {
    events: Array<EventSegment>;
    minimumStartDifference: number;
    slotMetrics: unknown;
    accessors: unknown;
};

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
    const styled = overlap(input) as Array<StyledSegment>;

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
