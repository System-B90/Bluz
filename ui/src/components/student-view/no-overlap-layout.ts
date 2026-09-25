import type { CSSProperties } from "react";
import type { DayLayoutFunction } from "react-big-calendar";

type Positioned<TEvent> = {
    event: TEvent;
    startMs: number;
    /** End of the drawn tile, which can outlast the event itself. */
    endMs: number;
    top: number;
    height: number;
    column: number;
    span: number;
};

/** Gap between side-by-side tiles, matching react-big-calendar's own. */
const PADDING_PX = 3;

const overlaps = <T>(a: Positioned<T>, b: Positioned<T>) =>
    a.startMs < b.endMs && b.startMs < a.endMs;

/**
 * Side-by-side day layout that never draws one tile over another.
 *
 * Replaces react-big-calendar's `"no-overlap"`, which decides overlap from
 * the tiles' floating-point percentage `top`/`height`: an event ending at
 * 11:15 and one starting at 11:15 can land a rounding error apart and get
 * split into half-width columns. Overlap here is decided on timestamps, so
 * back-to-back events stack vertically at full width.
 *
 * `minTileMs` is how much time the grid's minimum tile height covers. A short
 * event is drawn taller than its duration, so it claims that much time; zero
 * or unknown still claims 1ms, since a zero-length event draws a tile too.
 *
 * Events are grouped into clusters of transitively overlapping tiles; each
 * cluster is split into as many columns as it needs, and a tile stretches
 * over neighbouring columns it has to itself.
 */
export function createNoOverlapLayout(minTileMs = 0) {
    const minSpan = Math.max(1, minTileMs);

    return function noOverlapLayout<TEvent extends object>({
        accessors,
        events,
        slotMetrics,
    }: Parameters<DayLayoutFunction<TEvent>>[0]): Array<{
        event: TEvent;
        style: CSSProperties;
    }> {
        const positioned: Array<Positioned<TEvent>> = events
            .map((event) => {
                const { endDate, height, startDate, top } = slotMetrics.getRange(
                    accessors.start(event),
                    accessors.end(event),
                );
                return {
                    column: 0,
                    endMs: Math.max(+endDate, +startDate + minSpan),
                    event,
                    height,
                    span: 1,
                    startMs: +startDate,
                    top,
                };
            })
            .sort((a, b) => a.startMs - b.startMs || b.endMs - a.endMs);

        const styled: Array<{ event: TEvent; style: CSSProperties }> = [];
        let cluster: Array<Positioned<TEvent>> = [];
        let clusterEnd = -Infinity;

        const flush = () => {
            const columnEnds: Array<number> = [];
            for (const item of cluster) {
                const free = columnEnds.findIndex((end) => end <= item.startMs);
                item.column = free === -1 ? columnEnds.length : free;
                columnEnds[item.column] = item.endMs;
            }
            const width = 100 / columnEnds.length;
            for (const item of cluster) {
                while (
                    item.column + item.span < columnEnds.length &&
                    !cluster.some(
                        (other) =>
                            other.column === item.column + item.span &&
                            overlaps(item, other),
                    )
                ) {
                    item.span += 1;
                }
                const padding = item.column === 0 ? 0 : PADDING_PX;
                styled.push({
                    event: item.event,
                    style: {
                        height: `calc(${item.height}% - 2px)`,
                        top: item.top,
                        width: `calc(${width * item.span}% - ${padding}px)`,
                        xOffset: `calc(${width * item.column}% + ${padding}px)`,
                    } as CSSProperties,
                });
            }
            cluster = [];
        };

        for (const item of positioned) {
            if (item.startMs >= clusterEnd) {
                flush();
                clusterEnd = -Infinity;
            }
            cluster.push(item);
            clusterEnd = Math.max(clusterEnd, item.endMs);
        }
        flush();

        return styled;
    };
}
