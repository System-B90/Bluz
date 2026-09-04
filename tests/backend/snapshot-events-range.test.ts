import { describe, expect, it } from "vitest";

import { eventsDateRange } from "@/components/schedule/calendar/calendar/SnapshotMenu";
import { Event } from "@/components/schedule/types/event";

function eventAt(startIso: string, endIso: string): Event {
    return {
        id: `e-${startIso}`,
        startTime: new Date(startIso),
        endTime: new Date(endIso),
    } as unknown as Event;
}

/**
 * Restoring a snapshot first asks whether its events fall outside the range on
 * screen. That question has to survive a big snapshot — the answer used to be
 * a RangeError reported to the user as a plain "restore failed".
 */
describe("eventsDateRange (#614)", () => {
    it("spans the earliest start and the latest end", () => {
        const { rangeStart, rangeEnd } = eventsDateRange([
            eventAt("2026-06-28T09:00:00Z", "2026-06-28T10:00:00Z"),
            eventAt("2026-06-26T14:00:00Z", "2026-06-26T15:00:00Z"),
            eventAt("2026-06-27T08:00:00Z", "2026-06-30T23:00:00Z"),
        ]);

        expect(rangeStart.toISOString()).toBe("2026-06-26T14:00:00.000Z");
        expect(rangeEnd.toISOString()).toBe("2026-06-30T23:00:00.000Z");
    });

    it("handles a snapshot large enough to overflow an argument spread", () => {
        // `Math.min(...events.map(...))` throws RangeError well below this
        // count; folding does not.
        const base = Date.UTC(2026, 0, 1);
        const events = Array.from({ length: 200_000 }, (_, i) =>
            eventAt(
                new Date(base + i * 60_000).toISOString(),
                new Date(base + i * 60_000 + 30_000).toISOString(),
            ),
        );

        const { rangeStart, rangeEnd } = eventsDateRange(events);

        expect(rangeStart.valueOf()).toBe(base);
        expect(rangeEnd.valueOf()).toBe(base + 199_999 * 60_000 + 30_000);
    });
});
