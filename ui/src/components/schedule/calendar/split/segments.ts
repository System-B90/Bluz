import dayjs, { Dayjs } from "dayjs";

import {
    BreakWindow,
    collectBreakWindows,
    splitEventAcrossBreaks,
} from "@/api-shared/break-windows";
import { Event, EventId } from "@/components/schedule/types/event";

/**
 * One drawn piece of an event. A plain event yields exactly one segment; an
 * event that jumps over N breaks yields N+1.
 *
 * Segments are what react-big-calendar is fed — the calendar grid needs one
 * box per piece so the grid's own overlap layout stays correct — but they are
 * a *view model*, never persisted and never handed to anything outside the
 * calendar. Every interaction is translated back to `event` at the boundary,
 * which is what makes a split event behave as one cohesive thing.
 */
export type EventSegment = {
    /** Stable identity for this piece (`<event id>#<index>`). */
    key: string;
    /** The whole, canonical event this piece belongs to. */
    event: Event;
    /** This piece's own start on the grid. */
    from: Dayjs;
    /** This piece's own end on the grid. */
    to: Dayjs;
    /** 0-based position among the event's pieces. */
    index: number;
    /** How many pieces the event was drawn as. */
    count: number;
};

export function isFirstSegment(segment: EventSegment): boolean {
    return segment.index === 0;
}

export function isLastSegment(segment: EventSegment): boolean {
    return segment.index === segment.count - 1;
}

export function isSplitSegment(segment: EventSegment): boolean {
    return segment.count > 1;
}

/**
 * react-big-calendar's drag layer clones the dragged item and stamps the
 * proposed `start`/`end` onto the clone (see `EventContainerWrapper.update`).
 * Those two fields are the only reliable signal that a render is the drag
 * preview rather than a real grid item — our own segments never carry them.
 */
export type SegmentDragPreview = EventSegment & { end: Date; start: Date };

export function asDragPreview(
    segment: EventSegment,
): null | SegmentDragPreview {
    const candidate = segment as Partial<SegmentDragPreview>;
    return candidate.start && candidate.end
        ? (segment as SegmentDragPreview)
        : null;
}

/**
 * Expands every event into its drawn pieces.
 *
 * @param events The complete event set — breaks are harvested from it, so a
 *               range- or filter-narrowed subset would silently change how
 *               events split.
 * @param windows Break windows, when the caller already has them.
 * @returns Segments in event order, each tagged with its position.
 */
export function buildEventSegments(
    events: ReadonlyArray<Event>,
    windows: ReadonlyArray<BreakWindow> = collectBreakWindows(events),
): Array<EventSegment> {
    const segments: Array<EventSegment> = [];

    for (const event of events) {
        const pieces = splitEventAcrossBreaks(event, windows);
        for (const [ index, piece ] of pieces.entries()) {
            segments.push({
                key: segmentKey(event.id, index),
                event,
                from: dayjs(piece.start),
                to: dayjs(piece.end),
                index,
                count: pieces.length,
            });
        }
    }

    return segments;
}

export function segmentKey(eventId: EventId, index: number): string {
    return `${eventId}#${index}`;
}

/**
 * Break windows scoped to a single event, for callers that re-lay-out one
 * event live (the drag preview) rather than the whole grid.
 */
export type { BreakWindow };
