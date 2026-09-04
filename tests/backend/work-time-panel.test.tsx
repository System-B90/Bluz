// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { updateCurriculum } = vi.hoisted(() => ({
    updateCurriculum: vi.fn(async () => undefined),
}));

vi.mock("@/components/gantt/state/hooks/gantt-funcs/UseCurriculumActions", () => ({
    useCurriculumActions: () => ({ updateCurriculum }),
}));

import {
    GanttCurriculumId,
    GanttDayIndex,
    GanttWeekId,
} from "@/api-shared/types/gantt/models";
import { buildDefaultWeekDays } from "@/components/gantt/curriculum-view/components/WorkTimePanel/defaults";
import { useWorkTimePanelLogic } from "@/components/gantt/curriculum-view/components/WorkTimePanel/UseWorkTimePanelLogic";
import {
    cloneWeeks,
    pickNextDay,
} from "@/components/gantt/curriculum-view/components/WorkTimePanel/utils";

/** Enter in the hours/comment fields is the save gesture — nothing else fires it. */
const enterEvent = () =>
    ({ key: "Enter", preventDefault: vi.fn() }) as unknown as Parameters<
        ReturnType<typeof useWorkTimePanelLogic>["onHoursKeyDown"]
    >[ 0 ];

function renderPanel(curriculumId: null | string = "c1") {
    const setLocalWeekIds = vi.fn();
    const result = renderHook(() =>
        useWorkTimePanelLogic(
            curriculumId as GanttCurriculumId | null,
            [ "w1" ] as Array<GanttWeekId>,
            [ "w1", "w2" ] as Array<GanttWeekId>,
            setLocalWeekIds,
        ),
    ).result;
    return { result, setLocalWeekIds };
}

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe("WorkTimePanel helpers", () => {
    it("clones the week list instead of aliasing it", () => {
        const weeks = [ "w1" ] as Array<GanttWeekId>;

        const copy = cloneWeeks(weeks);
        copy.push("w2" as GanttWeekId);

        expect(weeks).toEqual([ "w1" ]);
    });

    it("picks the first weekday not already present, Saturday last", () => {
        expect(pickNextDay(new Set())).toBe(GanttDayIndex.Sunday);
        expect(
            pickNextDay(new Set([ GanttDayIndex.Sunday, GanttDayIndex.Monday ])),
        ).toBe(GanttDayIndex.Tuesday);
        expect(
            pickNextDay(
                new Set([ 0, 1, 2, 3, 4, 5 ] as Array<GanttDayIndex>),
            ),
        ).toBe(GanttDayIndex.Saturday);
    });

    it("returns null when the week is already full", () => {
        expect(
            pickNextDay(new Set([ 0, 1, 2, 3, 4, 5, 6 ] as Array<GanttDayIndex>)),
        ).toBeNull();
    });

    it("builds a default week of Sunday–Friday with their working minutes", () => {
        const days = buildDefaultWeekDays();

        expect(days).toHaveLength(6);
        expect(days.map((d) => d.dayIndex)).toEqual([ 0, 1, 2, 3, 4, 5 ]);
        expect(days[ 0 ].title).toBe("ראשון");
        expect(days[ 5 ].totalWorkingMinutes).toBeLessThan(
            days[ 0 ].totalWorkingMinutes!,
        );
        expect(days.every((d) => d.comment === "")).toBe(true);
    });
});

describe("useWorkTimePanelLogic", () => {
    it("persists the week order locally and to the server", async () => {
        const { result, setLocalWeekIds } = renderPanel();

        await act(async () => {
            await result.current.persistWeeks([ "w2", "w1" ] as Array<GanttWeekId>);
        });

        expect(setLocalWeekIds).toHaveBeenCalledWith([ "w2", "w1" ]);
        expect(updateCurriculum).toHaveBeenCalledWith("c1", {
            weeks: [ "w2", "w1" ],
        });
    });

    it("writes nothing without a curriculum", async () => {
        const { result, setLocalWeekIds } = renderPanel(null);

        await act(async () => {
            await result.current.persistWeeks([ "w1" ] as Array<GanttWeekId>);
        });

        expect(setLocalWeekIds).not.toHaveBeenCalled();
        expect(updateCurriculum).not.toHaveBeenCalled();
    });

    it("saves a copy of the local order, not the array itself", async () => {
        const { result } = renderPanel();

        await act(async () => {
            await result.current.saveDayHours();
        });

        expect(updateCurriculum).toHaveBeenCalledWith("c1", {
            weeks: [ "w1", "w2" ],
        });
    });

    it("applies a local update through the setter, on a clone", () => {
        const { result, setLocalWeekIds } = renderPanel();
        const original = [ "w1" ] as Array<GanttWeekId>;

        act(() =>
            result.current.updateWeeksLocally((weeks) => {
                weeks.push("w9" as GanttWeekId);
                return weeks;
            }),
        );

        const updater = setLocalWeekIds.mock.calls[ 0 ][ 0 ] as (
            prev: Array<GanttWeekId>,
        ) => Array<GanttWeekId>;
        expect(updater(original)).toEqual([ "w1", "w9" ]);
        expect(original).toEqual([ "w1" ]);
    });

    it("saves on Enter in the hours and week-comment fields", async () => {
        const { result } = renderPanel();

        const hoursEvent = enterEvent();
        await act(async () => result.current.onHoursKeyDown(hoursEvent));
        expect(hoursEvent.preventDefault).toHaveBeenCalled();

        await act(async () =>
            result.current.onWeekCommentKeyDown(enterEvent()),
        );

        expect(updateCurriculum).toHaveBeenCalledTimes(2);
    });

    it("ignores every other key", async () => {
        const { result } = renderPanel();
        const event = {
            key: "a",
            preventDefault: vi.fn(),
        } as unknown as Parameters<
            ReturnType<typeof useWorkTimePanelLogic>["onHoursKeyDown"]
        >[ 0 ];

        await act(async () => result.current.onHoursKeyDown(event));

        expect(event.preventDefault).not.toHaveBeenCalled();
        expect(updateCurriculum).not.toHaveBeenCalled();
    });
});
