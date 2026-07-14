import { describe, it, expect } from "vitest";

import { GanttWeek, GanttWeekId } from "@/api-shared/types/gantt/models";
import {
    buildDayIndexMap,
    buildWeekIndexByDayId,
} from "@/components/gantt/curriculum-view/gantt-time-utils";

function makeWeek(id: string, dayIds: Array<string>): GanttWeek {
    return {
        id: id as GanttWeekId,
        title: id,
        number: 1,
        days: dayIds,
        weekendDuty: false,
    } as unknown as GanttWeek;
}

describe("buildDayIndexMap", () => {
    it("maps each dayId to its position in the flattened list", () => {
        const map = buildDayIndexMap(["d1", "d2", "d3"]);
        expect(map.get("d1")).toBe(0);
        expect(map.get("d2")).toBe(1);
        expect(map.get("d3")).toBe(2);
    });

    it("returns undefined for a dayId not present", () => {
        const map = buildDayIndexMap(["d1"]);
        expect(map.get("missing")).toBeUndefined();
    });

    it("keeps the last index when a dayId repeats (defensive, not expected in practice)", () => {
        const map = buildDayIndexMap(["d1", "d2", "d1"]);
        expect(map.get("d1")).toBe(2);
    });
});

describe("buildWeekIndexByDayId", () => {
    it("maps each dayId to the index of its owning week", () => {
        const weeks = [
            makeWeek("w0", ["d1", "d2"]),
            makeWeek("w1", ["d3", "d4"]),
        ];
        const map = buildWeekIndexByDayId(weeks);
        expect(map.get("d1")).toBe(0);
        expect(map.get("d2")).toBe(0);
        expect(map.get("d3")).toBe(1);
        expect(map.get("d4")).toBe(1);
    });

    it("returns undefined for a dayId in no week", () => {
        const weeks = [makeWeek("w0", ["d1"])];
        const map = buildWeekIndexByDayId(weeks);
        expect(map.get("nope")).toBeUndefined();
    });

    it("matches the O(n) findIndex/includes scan it replaces", () => {
        const weeks = [
            makeWeek("w0", ["d1", "d2", "d3"]),
            makeWeek("w1", ["d4", "d5"]),
            makeWeek("w2", ["d6"]),
        ];
        const map = buildWeekIndexByDayId(weeks);
        const linearDayIds = weeks.flatMap((w) => w.days);

        for (const dayId of linearDayIds) {
            const expectedIdx = weeks.findIndex((w) => w.days.includes(dayId));
            expect(map.get(dayId)).toBe(expectedIdx);
        }
    });
});
