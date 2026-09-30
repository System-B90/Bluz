import { describe, expect, it } from "vitest";

import { EventRecurrence } from "@/api-shared/types/gantt/models";
import {
    buildDailyEventCells,
    buildWeeklyEventCells,
} from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/GanttEventCells";

const WEEKS = [
    { id: "wa", title: "1", days: [ "a1", "a2" ] },
    { id: "wb", title: "2", days: [ "b1", "b2" ] },
] as never;

type CellProps = {
    blockId?: string;
    blockTimeLabel?: string;
    hasBlock?: boolean;
    isRecurrence?: boolean;
    blockPayload?: { type?: string };
};

const props = (cells: Array<React.ReactElement>) =>
    cells.map((cell) => cell.props as CellProps);

const daily = (split?: Map<string, number>) =>
    props(
        buildDailyEventCells({
            timelineWeeks: WEEKS,
            moduleId: "m1",
            eventId: "e1",
            eventTitle: "ע\"ע",
            currentDayId: "a1",
            isEventUnmapped: false,
            violations: [],
            timeLabel: "3 ש׳",
            isRecurring: false,
            recurrenceSatisfied: true,
            recurrenceDayIds: new Set(),
            skippedRecurrenceDayIds: new Set(),
            firstDayId: "a1",
            splitPartMinutesByDay: split,
        }),
    );

const weekly = (split?: Map<string, number>) =>
    props(
        buildWeeklyEventCells({
            timelineWeeks: WEEKS,
            moduleId: "m1",
            eventId: "e1",
            eventTitle: "ע\"ע",
            currentDayId: "a1",
            isEventUnmapped: false,
            violations: [],
            relativeDaySizing: false,
            isRecurring: false,
            recurrence: EventRecurrence.None,
            recurrenceSatisfied: true,
            currentWeekIdx: 0,
            dayIndexOf: () => undefined,
            excludedDayIds: new Set(),
            skippedDayIds: new Set(),
            isDayInWindow: () => true,
            weekIndexByDayId: new Map([ [ "a1", 0 ], [ "a2", 0 ], [ "b1", 1 ], [ "b2", 1 ] ]),
            splitPartMinutesByDay: split,
        }),
    );

describe("split-across-weeks cells (#768)", () => {
    it("daily view: draws the later part as an inert, faded block with its hours", () => {
        const cells = daily(new Map([ [ "b1", 240 ] ]));
        const part = cells[ 2 ];

        expect(part.hasBlock).toBe(true);
        expect(part.isRecurrence).toBe(true);
        expect(part.blockId).toBe("split-event-e1-b1");
        expect(part.blockPayload?.type).toBeUndefined();
        expect(part.blockTimeLabel).toBeTruthy();
    });

    it("daily view: the mapped block stays draggable", () => {
        const [ start ] = daily(new Map([ [ "b1", 240 ] ]));

        expect(start.blockPayload?.type).toBe("event-move");
        expect(start.blockTimeLabel).toBe("3 ש׳");
    });

    it("weekly view: the part's week holds a split block", () => {
        const [ first, second ] = weekly(new Map([ [ "b1", 240 ] ]));

        expect(first.blockPayload?.type).toBe("event-move");
        expect(second.hasBlock).toBe(true);
        expect(second.blockId).toBe("split-event-e1-wb");
    });

    it("regression: an unsplit event draws no blocks outside its mapped day", () => {
        expect(daily().filter((cell) => cell.hasBlock)).toHaveLength(1);
        expect(weekly().filter((cell) => cell.hasBlock)).toHaveLength(1);
    });
});
