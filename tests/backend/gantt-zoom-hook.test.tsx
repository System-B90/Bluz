// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { GanttCurriculum, GanttWeek } from "@/api-shared/types/gantt/models";
import { useGanttZoom } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/use-gantt-zoom";

/**
 * The days-view zoom (#90) and its Ctrl+←/→ week stepping (#481). The keyboard
 * path is RTL-inverted, and the clamping at both ends is exactly what a
 * refactor breaks silently.
 */

const weeksById: Record<string, GanttWeek> = {
    w1: { id: "w1", days: [ "d1", "d2" ] },
    w2: { id: "w2", days: [ "d3", "d4" ] },
    w3: { id: "w3", days: [ "d5", "d6" ] },
} as unknown as Record<string, GanttWeek>;

const curriculum = {
    id: "c1",
    weeks: [ "w1", "w2", "w3" ],
} as unknown as GanttCurriculum;

const renderZoom = (args = { curriculum, weeksById }) =>
    renderHook(() => useGanttZoom(args)).result;

function pressCtrlArrow(key: "ArrowLeft" | "ArrowRight") {
    act(() => {
        window.dispatchEvent(
            new KeyboardEvent("keydown", { key, ctrlKey: true }),
        );
    });
}

afterEach(cleanup);

describe("useGanttZoom", () => {
    it("starts in weekly view showing every week", () => {
        const result = renderZoom();

        expect(result.current.weeklyView).toBe(true);
        expect(result.current.timelineWeeks).toHaveLength(3);
        expect(result.current.linearDays).toHaveLength(6);
        expect(result.current.singleWeekDayZoom).toBe(false);
    });

    it("drops unknown week ids instead of rendering holes", () => {
        const result = renderZoom({
            curriculum: {
                ...curriculum,
                weeks: [ "w1", "gone" ],
            } as unknown as GanttCurriculum,
            weeksById,
        });

        expect(result.current.allTimelineWeeks).toHaveLength(1);
    });

    it("restricts the grid to the zoomed week in day view", () => {
        const result = renderZoom();

        act(() => result.current.setWeeklyView(false));
        act(() => result.current.setZoomedWeekId("w2"));

        expect(result.current.timelineWeeks.map((w) => w.id)).toEqual([ "w2" ]);
        expect(result.current.linearDays).toEqual([ "d3", "d4" ]);
        expect(result.current.weekIndexOffset).toBe(1);
        expect(result.current.singleWeekDayZoom).toBe(true);
    });

    it("ignores a zoomed week while weekly view is on", () => {
        const result = renderZoom();

        act(() => result.current.setZoomedWeekId("w2"));

        expect(result.current.timelineWeeks).toHaveLength(3);
        expect(result.current.weekIndexOffset).toBe(0);
        expect(result.current.singleWeekDayZoom).toBe(false);
    });

    it("clears the zoom when returning to weekly view", () => {
        const result = renderZoom();

        act(() => result.current.handleWeeklyViewChange(false));
        act(() => result.current.setZoomedWeekId("w2"));
        act(() => result.current.handleWeeklyViewChange(true));

        expect(result.current.zoomedWeekId).toBeNull();
        expect(result.current.weeklyView).toBe(true);
    });

    it("steps forward from the first week and back from the last", () => {
        const forward = renderZoom();
        act(() => forward.current.stepZoomedWeek(1));
        expect(forward.current.zoomedWeekId).toBe("w1");

        cleanup();

        const backward = renderZoom();
        act(() => backward.current.stepZoomedWeek(-1));
        expect(backward.current.zoomedWeekId).toBe("w3");
    });

    it("clamps stepping at both ends", () => {
        const result = renderZoom();

        act(() => result.current.setZoomedWeekId("w3"));
        act(() => result.current.stepZoomedWeek(1));
        expect(result.current.zoomedWeekId).toBe("w3");

        act(() => result.current.setZoomedWeekId("w1"));
        act(() => result.current.stepZoomedWeek(-1));
        expect(result.current.zoomedWeekId).toBe("w1");
    });

    it("does nothing when the curriculum has no weeks", () => {
        const result = renderZoom({
            curriculum: { ...curriculum, weeks: [] } as unknown as GanttCurriculum,
            weeksById,
        });

        act(() => result.current.stepZoomedWeek(1));

        expect(result.current.zoomedWeekId).toBeNull();
    });

    it("walks the weeks with Ctrl+←/→, RTL-inverted (#481)", () => {
        const result = renderZoom();
        act(() => result.current.handleWeeklyViewChange(false));

        pressCtrlArrow("ArrowLeft");
        expect(result.current.zoomedWeekId).toBe("w1");

        pressCtrlArrow("ArrowLeft");
        expect(result.current.zoomedWeekId).toBe("w2");

        pressCtrlArrow("ArrowRight");
        expect(result.current.zoomedWeekId).toBe("w1");
    });

    it("does not bind the shortcut in weekly view", () => {
        const result = renderZoom();

        pressCtrlArrow("ArrowLeft");

        expect(result.current.zoomedWeekId).toBeNull();
    });

    it("never steals the shortcut from a field being typed in", () => {
        const result = renderZoom();
        act(() => result.current.handleWeeklyViewChange(false));

        const input = document.createElement("input");
        document.body.appendChild(input);
        act(() => {
            input.dispatchEvent(
                new KeyboardEvent("keydown", {
                    key: "ArrowLeft",
                    ctrlKey: true,
                    bubbles: true,
                }),
            );
        });

        expect(result.current.zoomedWeekId).toBeNull();
        input.remove();
    });

    it("keeps the default column width until a week is zoomed", () => {
        const result = renderZoom();

        expect(result.current.dayCellWidth).toBe(80);

        act(() => result.current.handleWeeklyViewChange(false));
        act(() => result.current.setZoomedWeekId("w1"));

        // No measured container in jsdom, so it stays at the floor rather than
        // collapsing to zero.
        expect(result.current.dayCellWidth).toBe(80);
    });
});
