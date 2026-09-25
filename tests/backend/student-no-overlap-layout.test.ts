import moment from "moment-timezone";
import { momentLocalizer } from "react-big-calendar";
import rbcNoOverlap from "react-big-calendar/lib/utils/layout-algorithms/no-overlap";
import { getSlotMetrics } from "react-big-calendar/lib/utils/TimeSlots";
import { beforeAll, describe, expect, it } from "vitest";

import { APP_TIMEZONE } from "@/api-shared/dayjs-setup";
import { createNoOverlapLayout } from "@/components/student-view/no-overlap-layout";

/*
 * The student board must never draw one tile over another, and must never
 * split tiles that merely touch (#656). Layout runs against react-big-
 * calendar's real slot metrics, so the float percentages here are exactly
 * the ones the board renders with.
 */

type Ev = { id: string; start: Date; end: Date };
type Box = {
    id: string;
    top: number;
    left: number;
    right: number;
};

const DAY = "2026-09-20";
const ACCESSORS = {
    end: (e: Ev) => e.end,
    start: (e: Ev) => e.start,
};
const EPS = 1e-6;

let localizer: ReturnType<typeof momentLocalizer>;
beforeAll(() => {
    moment.tz.setDefault(APP_TIMEZONE);
    localizer = momentLocalizer(moment);
});

const at = (minutes: number) =>
    moment
        .tz(DAY, APP_TIMEZONE)
        .startOf("day")
        .add(minutes, "minutes")
        .toDate();
const hm = (h: number, m = 0) => h * 60 + m;
const ev = (id: string, from: number, to: number): Ev => ({
    end: at(to),
    id,
    start: at(from),
});

function metrics(min = hm(7, 30), max = hm(21)) {
    return getSlotMetrics({
        localizer,
        max: at(max),
        min: at(min),
        step: 15,
        timeslots: 4,
    });
}

/** `calc(A% ± Bpx)` → A. Pixel padding is cosmetic and never creates overlap. */
function percent(value: unknown): number {
    const match = String(value).match(/^calc\((-?[\d.e+-]+)%/);
    if (!match) throw new Error(`unexpected style value ${String(value)}`);
    return Number(match[1]);
}

function layout(events: Array<Ev>, slotMetrics = metrics(), minTileMs = 0) {
    return createNoOverlapLayout(minTileMs)<Ev>({
        accessors: ACCESSORS,
        events,
        minimumStartDifference: 15 * 60_000,
        slotMetrics,
    });
}

function boxes(
    events: Array<Ev>,
    slotMetrics = metrics(),
    minTileMs = 0,
): Map<string, Box> {
    return new Map(
        layout(events, slotMetrics, minTileMs).map(({ event, style }) => {
            const left = percent(style.xOffset);
            return [
                event.id,
                {
                    id: event.id,
                    left,
                    right: left + percent(style.width),
                    top: Number(style.top),
                },
            ];
        }),
    );
}

const width = (b: Box) => b.right - b.left;
const fullWidth = (b: Box) =>
    Math.abs(b.left) < EPS && Math.abs(b.right - 100) < EPS;
/** A tile is drawn at least `minTileMs` (and at least 1ms) tall. */
const drawnEnd = (e: Ev, minTileMs: number) =>
    Math.max(+e.end, +e.start + Math.max(1, minTileMs));
const timesOverlap = (a: Ev, b: Ev, minTileMs = 0) =>
    +a.start < drawnEnd(b, minTileMs) && +b.start < drawnEnd(a, minTileMs);
const columnsOverlap = (a: Box, b: Box) =>
    a.left < b.right - EPS && b.left < a.right - EPS;

/** Tiles of time-overlapping events must sit in disjoint columns. */
function assertNoVisualOverlap(
    events: Array<Ev>,
    slotMetrics = metrics(),
    minTileMs = 0,
) {
    const placed = boxes(events, slotMetrics, minTileMs);
    expect(placed.size).toBe(events.length);
    for (const [i, a] of events.entries()) {
        const boxA = placed.get(a.id)!;
        expect(boxA.left).toBeGreaterThanOrEqual(-EPS);
        expect(boxA.right).toBeLessThanOrEqual(100 + EPS);
        expect(width(boxA)).toBeGreaterThan(0);
        for (const b of events.slice(i + 1)) {
            if (!timesOverlap(a, b, minTileMs)) continue;
            expect(
                columnsOverlap(boxA, placed.get(b.id)!),
                `${a.id} and ${b.id} are drawn over each other`,
            ).toBe(false);
        }
    }
    return placed;
}

/** Deterministic PRNG so a failing seed reproduces. */
function rng(seed: number) {
    let state = seed;
    return () => {
        state = (state * 1_103_515_245 + 12_345) % 2 ** 31;
        return state / 2 ** 31;
    };
}

describe("noOverlapLayout — back-to-back events", () => {
    it("keeps the repro pair (ends 11:15, starts 11:15) full width", () => {
        const placed = boxes([
            ev("first", hm(10, 30), hm(11, 15)),
            ev("second", hm(11, 15), hm(12)),
        ]);

        expect(fullWidth(placed.get("first")!)).toBe(true);
        expect(fullWidth(placed.get("second")!)).toBe(true);
    });

    it("keeps a whole day of touching events full width", () => {
        const events = Array.from({ length: 24 }, (_, i) =>
            ev(`e${i}`, hm(8) + i * 30, hm(8) + (i + 1) * 30),
        );

        for (const box of boxes(events).values()) {
            expect(fullWidth(box)).toBe(true);
        }
    });

    // Every boundary, length and grid start the board can render. The
    // built-in layout fails some of these on float rounding alone.
    it("never splits touching events, at any minute, length or grid start", () => {
        const failures: Array<string> = [];
        for (const min of [hm(0), hm(7), hm(7, 30), hm(7, 45), hm(8, 5)]) {
            const slotMetrics = metrics(min, hm(22));
            for (let edge = hm(9); edge < hm(21); edge += 5) {
                for (const before of [5, 15, 45, 50, 60, 75, 90, 105, 120]) {
                    for (const after of [5, 15, 45, 60, 90]) {
                        const placed = boxes(
                            [
                                ev("a", edge - before, edge),
                                ev("b", edge, edge + after),
                            ],
                            slotMetrics,
                        );
                        if (![...placed.values()].every(fullWidth)) {
                            failures.push(
                                `min=${min} edge=${edge} ${before}/${after}`,
                            );
                        }
                    }
                }
            }
        }

        expect(failures).toEqual([]);
    });

    it("documents that react-big-calendar's own no-overlap splits touching events", () => {
        let split = 0;
        const slotMetrics = metrics();
        for (let edge = hm(8, 30); edge < hm(20); edge += 5) {
            for (const before of [45, 60, 75, 90, 105]) {
                const out: Array<{ style: { width: string } }> = rbcNoOverlap({
                    accessors: ACCESSORS,
                    events: [
                        ev("a", edge - before, edge),
                        ev("b", edge, edge + 45),
                    ],
                    minimumStartDifference: 15 * 60_000,
                    slotMetrics,
                });
                if (out.some((o) => !o.style.width.startsWith("calc(100%"))) {
                    split += 1;
                }
            }
        }

        // Reaching 0 means upstream fixed it and the custom layout can go.
        expect(split).toBeGreaterThan(0);
    });

    it("does not chain a touching event into its neighbour's cluster", () => {
        const placed = boxes([
            ev("a", hm(9), hm(10)),
            ev("b", hm(9), hm(10)),
            ev("c", hm(10), hm(11)),
        ]);

        expect(width(placed.get("a")!)).toBeCloseTo(50);
        expect(fullWidth(placed.get("c")!)).toBe(true);
    });
});

describe("noOverlapLayout — overlapping events", () => {
    it("splits two overlapping events into halves", () => {
        const placed = assertNoVisualOverlap([
            ev("a", hm(9), hm(10)),
            ev("b", hm(9, 30), hm(10, 30)),
        ]);

        for (const box of placed.values()) {
            expect(width(box)).toBeCloseTo(50);
        }
    });

    it("splits a one-minute overlap", () => {
        assertNoVisualOverlap([
            ev("a", hm(9), hm(10, 1)),
            ev("b", hm(10), hm(11)),
        ]);
    });

    it("splits identical events into equal thirds", () => {
        const placed = assertNoVisualOverlap(
            ["a", "b", "c"].map((id) => ev(id, hm(9), hm(10))),
        );

        for (const box of placed.values()) {
            expect(width(box)).toBeCloseTo(100 / 3);
        }
    });

    it("separates three nested events", () => {
        assertNoVisualOverlap([
            ev("a", hm(9), hm(12)),
            ev("b", hm(9, 30), hm(11)),
            ev("c", hm(10), hm(10, 30)),
        ]);
    });

    it("reuses a freed column instead of adding one", () => {
        const placed = assertNoVisualOverlap([
            ev("long", hm(9), hm(12)),
            ev("early", hm(9), hm(10)),
            ev("late", hm(10), hm(11)),
        ]);

        expect(placed.get("early")!.left).toBeCloseTo(placed.get("late")!.left);
        expect(width(placed.get("long")!)).toBeCloseTo(50);
    });

    it("stretches a tile across columns it has to itself", () => {
        const placed = assertNoVisualOverlap([
            ev("a", hm(9), hm(10)),
            ev("b", hm(9), hm(9, 30)),
            ev("c", hm(9), hm(9, 30)),
            ev("d", hm(9, 30), hm(10)),
        ]);

        // d starts once b and c end, so it takes both of their columns.
        expect(width(placed.get("d")!)).toBeCloseTo(200 / 3);
    });

    it("never stretches over a column holding an overlapping tile", () => {
        assertNoVisualOverlap([
            ev("a", hm(9), hm(9, 30)),
            ev("b", hm(9), hm(11)),
            ev("c", hm(9), hm(9, 30)),
            ev("d", hm(9, 30), hm(10)),
            ev("e", hm(10), hm(11)),
        ]);
    });

    it("lays out separate clusters independently", () => {
        const placed = assertNoVisualOverlap([
            ev("a", hm(9), hm(10)),
            ev("b", hm(9), hm(10)),
            ev("solo", hm(12), hm(13)),
        ]);

        expect(fullWidth(placed.get("solo")!)).toBe(true);
    });

    it("puts a zero-length event beside one starting at the same instant", () => {
        const placed = assertNoVisualOverlap([
            ev("point", hm(9), hm(9)),
            ev("lesson", hm(9), hm(10)),
        ]);

        expect(width(placed.get("point")!)).toBeCloseTo(50);
    });

    it("keeps a zero-length event at another's end full width", () => {
        const placed = boxes([
            ev("lesson", hm(9), hm(10)),
            ev("point", hm(10), hm(10)),
        ]);

        expect(fullWidth(placed.get("point")!)).toBe(true);
    });

    it("handles zero-length events", () => {
        assertNoVisualOverlap([
            ev("a", hm(9), hm(9)),
            ev("b", hm(9), hm(10)),
            ev("c", hm(8), hm(11)),
        ]);
    });

    it("handles events running past the grid bounds", () => {
        assertNoVisualOverlap(
            [ev("a", hm(6), hm(9)), ev("b", hm(8), hm(23))],
            metrics(hm(7, 30), hm(21)),
        );
    });
});

describe("noOverlapLayout — short tiles drawn taller than their event", () => {
    const TWENTY_MIN = 20 * 60_000;

    it("puts an event beside a short one whose drawn tile reaches it", () => {
        const placed = assertNoVisualOverlap(
            [ev("short", hm(9), hm(9, 5)), ev("next", hm(9, 10), hm(10))],
            metrics(),
            TWENTY_MIN,
        );

        expect(width(placed.get("short")!)).toBeCloseTo(50);
        expect(width(placed.get("next")!)).toBeCloseTo(50);
    });

    it("keeps full width once the drawn tile has ended", () => {
        const placed = boxes(
            [ev("short", hm(9), hm(9, 5)), ev("later", hm(9, 20), hm(10))],
            metrics(),
            TWENTY_MIN,
        );

        expect(fullWidth(placed.get("short")!)).toBe(true);
        expect(fullWidth(placed.get("later")!)).toBe(true);
    });

    it("leaves events longer than the minimum tile untouched", () => {
        const placed = boxes(
            [ev("a", hm(9), hm(10)), ev("b", hm(10), hm(11))],
            metrics(),
            TWENTY_MIN,
        );

        expect([...placed.values()].every(fullWidth)).toBe(true);
    });

    it("keeps touching events full width at every minimum tile size", () => {
        for (const minutes of [0, 1, 5, 15, 30, 45]) {
            const placed = boxes(
                [ev("a", hm(10, 30), hm(11, 15)), ev("b", hm(11, 15), hm(12))],
                metrics(),
                minutes * 60_000,
            );

            expect([...placed.values()].every(fullWidth), `${minutes}m`).toBe(
                true,
            );
        }
    });

    it("treats a negative minimum as none", () => {
        const placed = boxes(
            [ev("a", hm(9), hm(10)), ev("b", hm(10), hm(11))],
            metrics(),
            -5,
        );

        expect([...placed.values()].every(fullWidth)).toBe(true);
    });
});

describe("noOverlapLayout — invariants over random days", () => {
    for (let seed = 1; seed <= 200; seed++) {
        it(`seed ${seed}: no tile covers another, a lone event owns its row`, () => {
            const random = rng(seed);
            const count = 1 + Math.floor(random() * 25);
            const events = Array.from({ length: count }, (_, i) => {
                const start =
                    hm(8) +
                    Math.floor(random() * 48) * 15 +
                    Math.floor(random() * 3) * 5;
                const length = [0, 5, 15, 30, 45, 60, 75, 90, 180][
                    Math.floor(random() * 9)
                ];
                return ev(`e${i}`, start, start + length);
            });

            const minTileMs = [0, 5, 20, 30][seed % 4] * 60_000;

            const placed = assertNoVisualOverlap(events, metrics(), minTileMs);

            for (const event of events) {
                const alone = events.every(
                    (other) =>
                        other === event ||
                        !timesOverlap(event, other, minTileMs),
                );
                if (alone) {
                    expect(fullWidth(placed.get(event.id)!), event.id).toBe(true);
                }
            }
        });
    }

    it("does not depend on input order", () => {
        const random = rng(42);
        const events = Array.from({ length: 30 }, (_, i) => {
            const start = hm(8) + Math.floor(random() * 40) * 15;
            return ev(
                `e${i}`,
                start,
                start + 15 * (1 + Math.floor(random() * 6)),
            );
        });
        const shuffled = [...events].reverse();

        const summary = (list: Array<Ev>) =>
            [...boxes(list).values()]
                .sort((a, b) => a.id.localeCompare(b.id))
                .map((b) => [b.id, b.top, width(b).toFixed(6)]);

        expect(summary(shuffled)).toEqual(summary(events));
    });

    it("returns every event exactly once", () => {
        const events = Array.from({ length: 50 }, (_, i) =>
            ev(`e${i}`, hm(8) + (i % 7) * 20, hm(9) + (i % 5) * 20),
        );

        expect(
            layout(events)
                .map((o) => o.event.id)
                .sort(),
        ).toEqual(events.map((e) => e.id).sort());
    });

    it("returns nothing for an empty day", () => {
        expect(layout([])).toEqual([]);
    });
});
