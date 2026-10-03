// @vitest-environment jsdom

import { createTheme, ThemeProvider } from "@mui/material/styles";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Time metrics on the רצף זמן timeline (#766): each row shows its required
 * hours, and each week header shows allocated / available hours.
 */

const { state } = vi.hoisted(() => ({
    state: {
        days: {
            d1: { id: "d1", dayIndex: 0, totalWorkingMinutes: 480 },
            d2: { id: "d2", dayIndex: 1, totalWorkingMinutes: 600 },
        },
    },
}));

vi.mock("@/components/gantt/state/context", () => ({
    useCurriculumState: () => state,
}));

import { GanttContext } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/context";
import { GanttHeader } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/GanttHeader";
import { GanttHoursLabel } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/GanttHoursLabel";

afterEach(cleanup);

/** One all-students path per day, carrying `scheduled` minutes. */
function loadOf(scheduled: Record<string, number>, issues: Array<unknown> = []) {
    return Object.fromEntries(
        Object.entries(scheduled).map(([ dayId, minutes ]) => [
            dayId,
            { minutes, paths: [ { pathId: "all", minutes, bySyllabus: [] } ], issues },
        ]),
    );
}

function renderHeader(
    showConstraints: boolean,
    scheduled: Record<string, number>,
    { dayZoom = false, issues = [] as Array<unknown> } = {},
) {
    const ctx = {
        dayCellWidth: 40,
        scheduledMinutesByDay: scheduled,
        studentLoadByDay: loadOf(scheduled, issues),
        studentPaths: [ { id: "all", courseIds: [], label: "כל החניכים" } ],
        setWeeklyView: vi.fn(),
        setZoomedWeekId: vi.fn(),
        singleWeekDayZoom: dayZoom,
        startDate: null,
        timelineWeeks: [ { id: "w1", title: "שבוע 1", days: [ "d1", "d2" ] } ],
        weeklyView: !dayZoom,
        weekIndexOffset: 0,
        zoomedWeekId: null,
    };
    render(
        <ThemeProvider theme={ createTheme({ cssVariables: true }) }>
            <GanttContext.Provider value={ ctx as never }>
                <table>
                    <GanttHeader showConstraints={ showConstraints } />
                </table>
            </GanttContext.Provider>
        </ThemeProvider>,
    );
}

describe("GanttHoursLabel (#766)", () => {
    it("shows the minutes as hours", () => {
        render(<GanttHoursLabel minutes={ 570 } />);

        expect(screen.getByTestId("gantt-hours-label").textContent).toBe("9.5 ש׳");
    });
});

describe("GanttHeader week hours (#766)", () => {
    it("shows allocated out of available hours per week", () => {
        renderHeader(true, { d1: 300, d2: 270 });

        expect(screen.getByTestId("gantt-week-hours").textContent).toBe("9.5 ש׳ / 18 ש׳");
    });

    it("regression: shows the week hours even with constraints hidden", () => {
        renderHeader(false, { d1: 60 });

        expect(screen.getByTestId("gantt-week-hours").textContent).toBe("1 ש׳ / 18 ש׳");
    });
});

describe("GanttHeader day hours in a zoomed week", () => {
    it("shows one student's day time out of the day's capacity", () => {
        renderHeader(true, { d1: 300 }, { dayZoom: true });

        expect(screen.getAllByTestId("gantt-day-hours")[ 0 ].textContent).toBe("5 ש׳ / 8 ש׳");
    });

    it("flags a day whose shuffles don't line up", () => {
        renderHeader(true, { d1: 300 }, { dayZoom: true, issues: [ { kind: "shuffles-misaligned" } ] });

        expect(screen.getAllByTestId("gantt-day-load-issue")).toHaveLength(1);
    });
});

describe("GanttHeader warnings (#812, #822, #829)", () => {
    it("shows the ⚠ only when the whole week is over its hours", () => {
        // d1 600 > 480 and the week 600+600 > 1080.
        renderHeader(true, { d1: 600, d2: 600 });
        expect(screen.getByTestId("gantt-week-overload")).toBeTruthy();
        expect(screen.queryByTestId("gantt-week-day-overload")).toBeNull();
    });

    it("marks a single overloaded day with a quiet dot, not the ⚠", () => {
        // d1 600 > 480, but the week 600 < 1080 still fits.
        renderHeader(true, { d1: 600 });
        expect(screen.queryByTestId("gantt-week-overload")).toBeNull();
        expect(screen.getByTestId("gantt-week-day-overload").getAttribute("aria-label")).toContain("ראשון");
    });

    it("shows nothing when no day is over", () => {
        renderHeader(true, { d1: 60 });
        expect(screen.queryByTestId("gantt-week-overload")).toBeNull();
        expect(screen.queryByTestId("gantt-week-day-overload")).toBeNull();
    });

    it("labels the X / Y pair as scheduled out of available", () => {
        renderHeader(true, { d1: 300, d2: 270 });
        expect(screen.getByTestId("gantt-week-hours").getAttribute("title")).toContain("משובץ 9.5 ש׳ מתוך 18 ש׳ זמינות");
    });

    it("uses tabular digits for the week totals", () => {
        renderHeader(true, { d1: 300 });
        expect(getComputedStyle(screen.getByTestId("gantt-week-hours")).fontVariantNumeric).toBe("tabular-nums");
    });

    it("marks the overloaded day itself in the daily view", () => {
        renderHeader(true, { d1: 600 }, { dayZoom: true });
        expect(screen.getAllByTestId("gantt-day-overload")).toHaveLength(1);
    });

    it("drops the day mark when constraints are hidden", () => {
        renderHeader(false, { d1: 600 }, { dayZoom: true });
        expect(screen.queryByTestId("gantt-day-overload")).toBeNull();
    });
});
