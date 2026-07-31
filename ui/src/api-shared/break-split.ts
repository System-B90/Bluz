export type BreakWindow = { start: Date; end: Date };

/**
 * Extends `endTime` past any break window it overlaps, so an event's actual
 * working time survives instead of being eaten by the break. `startTime`
 * never moves — only the tail is pushed out by each overlapping window's
 * length. Windows are assumed non-overlapping with each other (true for
 * meal/break events in practice).
 */
export function extendEndPastBreaks(
    startTime: Date,
    endTime: Date,
    breaks: Array<BreakWindow>,
): Date {
    const sorted = [ ...breaks ].sort(
        (a, b) => a.start.getTime() - b.start.getTime(),
    );
    let endMs = endTime.getTime();
    for (const brk of sorted) {
        if (startTime.getTime() < brk.end.getTime() && endMs > brk.start.getTime()) {
            endMs += brk.end.getTime() - brk.start.getTime();
        }
    }
    return new Date(endMs);
}
