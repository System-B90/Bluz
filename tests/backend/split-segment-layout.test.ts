import { beforeEach, describe, expect, it, vi } from "vitest";

const { overlap } = vi.hoisted(() => ({ overlap: vi.fn() }));

vi.mock(
    "react-big-calendar/lib/utils/layout-algorithms/overlap",
    () => ({ default: overlap }),
);

import { splitAwareDayLayout } from "@/components/schedule/calendar/split/segment-layout";

type Placed = {
    id: string;
    index: number;
    count: number;
    xOffset: number;
    width: number;
};

/** What `overlap` would have returned for these pieces. */
function styled(placements: Array<Placed>) {
    return placements.map((p) => ({
        event: {
            key: `${p.id}#${p.index}`,
            event: { id: p.id },
            index: p.index,
            count: p.count,
        },
        style: { top: 0, height: 10, width: p.width, xOffset: p.xOffset },
    }));
}

const input = {
    events: [],
    minimumStartDifference: 0,
    slotMetrics: {},
    accessors: {},
} as never;

function run(placements: Array<Placed>) {
    overlap.mockReturnValueOnce(styled(placements));
    return splitAwareDayLayout(input).map((entry) => ({
        key: entry.event.key,
        xOffset: entry.style.xOffset,
        width: entry.style.width,
    }));
}

describe("splitAwareDayLayout", () => {
    beforeEach(() => overlap.mockReset());

    it("leaves unsplit events exactly where the overlap algorithm put them", () => {
        const result = run([
            { id: "a", index: 0, count: 1, xOffset: 0, width: 50 },
            { id: "b", index: 0, count: 1, xOffset: 50, width: 50 },
        ]);

        expect(result).toEqual([
            { key: "a#0", xOffset: 0, width: 50 },
            { key: "b#0", xOffset: 50, width: 50 },
        ]);
    });

    it("squares a split event's pieces onto their shared strip", () => {
        // The piece running into the break shares the column (0→50); the other
        // piece has it to itself (0→100). Both should end up at the narrow one.
        const result = run([
            { id: "a", index: 0, count: 2, xOffset: 0, width: 50 },
            { id: "a", index: 1, count: 2, xOffset: 0, width: 100 },
        ]);

        expect(result).toEqual([
            { key: "a#0", xOffset: 0, width: 50 },
            { key: "a#1", xOffset: 0, width: 50 },
        ]);
    });

    it("intersects bands that start at different offsets", () => {
        const result = run([
            { id: "a", index: 0, count: 2, xOffset: 0, width: 80 },
            { id: "a", index: 1, count: 2, xOffset: 20, width: 80 },
        ]);

        // Intersection of [0,80] and [20,100] is [20,80].
        expect(result).toEqual([
            { key: "a#0", xOffset: 20, width: 60 },
            { key: "a#1", xOffset: 20, width: 60 },
        ]);
    });

    it("leaves pieces alone when their bands do not intersect at all", () => {
        const result = run([
            { id: "a", index: 0, count: 2, xOffset: 0, width: 40 },
            { id: "a", index: 1, count: 2, xOffset: 60, width: 40 },
        ]);

        expect(result).toEqual([
            { key: "a#0", xOffset: 0, width: 40 },
            { key: "a#1", xOffset: 60, width: 40 },
        ]);
    });

    it("only narrows the split event, not its neighbours", () => {
        const result = run([
            { id: "a", index: 0, count: 2, xOffset: 0, width: 50 },
            { id: "a", index: 1, count: 2, xOffset: 0, width: 100 },
            { id: "b", index: 0, count: 1, xOffset: 50, width: 50 },
        ]);

        expect(result.at(-1)).toEqual({ key: "b#0", xOffset: 50, width: 50 });
    });

    it("returns the algorithm's own array when nothing is split", () => {
        const original = styled([
            { id: "a", index: 0, count: 1, xOffset: 0, width: 100 },
        ]);
        overlap.mockReturnValueOnce(original);

        expect(splitAwareDayLayout(input)).toBe(original);
    });
});
