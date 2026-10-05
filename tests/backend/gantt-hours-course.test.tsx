// @vitest-environment jsdom

import { createTheme, ThemeProvider } from "@mui/material/styles";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * #899: the gantt's scheduled-hours totals are one student's time, never a
 * sum over courses no student attends together, and a dropdown picks whose.
 * Apollo has a 1h event, Sphinx a 2h one, both on the same day: the busiest
 * course is 2h (not 3h), Apollo alone 1h.
 */

const { courses, state } = vi.hoisted(() => ({
    courses: [
        { id: "bis", name: "ביס90", color: null, parentId: null },
        { id: "apollo", name: "אפולו", color: null, parentId: "bis" },
        { id: "sphinx", name: "ספינקס", color: null, parentId: "bis" },
    ],
    state: {
        days: { d1: { id: "d1", dayIndex: 0, totalWorkingMinutes: 480 } },
        weeks: { w1: { id: "w1", days: [ "d1" ] } },
        syllabuses: { s1: { id: "s1", title: "סילבוס", modules: [ "m1" ], courseIds: [], shuffles: [] } },
        modules: { m1: { id: "m1", title: "מודול", syllabusId: "s1", events: [ "eA", "eS" ], shuffles: [] } },
        events: Object.fromEntries([ [ "eA", "apollo", 60 ], [ "eS", "sphinx", 120 ] ].map(([ id, course, minutes ]) => [ id, {
            id,
            title: `אירוע ${course}`,
            moduleId: "m1",
            minimumDuration: minutes,
            courseIds: [ course ],
            shuffles: [],
            recurrence: "none",
            recurrenceStartDate: null,
            recurrenceEndDate: null,
            constraints: [],
        } ])),
    },
}));

vi.mock("@/components/gantt/state/context", () => ({
    useCurriculumState: () => state,
    useCurriculumProviderActions: () => ({ openEventDialog: vi.fn(), openModuleDialog: vi.fn(), openSyllabusDialog: vi.fn() }),
}));
vi.mock("@/components/base/CoursesProvider", () => ({ useCourses: () => ({ courses }) }));
vi.mock("notistack", () => ({ useSnackbar: () => ({ enqueueSnackbar: vi.fn() }) }));
vi.mock("@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/use-grid-allotment", () => ({
    useGridAllotment: () => ({ commitWeek: vi.fn(), splitShuffles: vi.fn(), dialog: null }),
}));
vi.mock("@/components/gantt/state/recurrence-exceptions/hooks", () => ({
    useGanttRecurrenceExceptions: () => ({ state: { exceptions: {} } }),
}));
vi.mock("@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/UseGanttView", () => ({
    useGanttView: () => ({ curriculum: { syllabuses: [ "s1" ] }, contextValue: contextValue() }),
}));

import { Course } from "@/api-shared/types/course";
import { setHoursFormat } from "@/components/gantt/curriculum-view/gantt-time-utils";
import { computeStudentSchedule } from "@/components/gantt/curriculum-view/student-load";
import { GanttContext } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/context";
import { GanttGridView } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/GanttGridView";
import { GanttHeader } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/GanttHeader";
import { setGridCompactHeader } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/grid-preferences";
import { hoursCourse } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/HoursCourseSelect";

/** Both events placed on d1, laid out by the real student-load calculation. */
function contextValue() {
    const mappings = Object.fromEntries([ "eA", "eS" ].map((eventId, sortOrder) => [ eventId, {
        curriculumId: "c1",
        moduleId: "m1",
        eventId,
        dayId: "d1",
        sortOrder,
        allottedMinutes: state.events[ eventId ].minimumDuration,
    } ]));
    const schedule = computeStudentSchedule({
        courses: courses as Array<Course>,
        exceptions: {},
        linearDays: [ "d1" ],
        mappings,
        state: state as never,
        syllabusIds: [ "s1" ],
    });
    return {
        allLinearDays: [ "d1" ],
        curriculumMappings: mappings,
        dateOfDayId: () => undefined,
        dayCellWidth: 40,
        eventSpans: schedule.spans,
        ignoreBreaks: false,
        isModuleExpanded: () => true,
        isSyllabusExpanded: () => true,
        setAllRows: vi.fn(),
        setWeeklyView: vi.fn(),
        setZoomedWeekId: vi.fn(),
        singleWeekDayZoom: false,
        startDate: null,
        studentLoadByDay: schedule.byDay,
        studentLoadWithBreaksByDay: schedule.byDay,
        studentPaths: schedule.paths,
        timelineWeeks: [ { id: "w1", title: "שבוע 1", days: [ "d1" ] } ],
        toggleModule: vi.fn(),
        toggleSyllabus: vi.fn(),
        weekIndexByDayId: new Map([ [ "d1", 0 ] ]),
        weekIndexOffset: 0,
        weeklyView: true,
        zoomedWeekId: null,
    };
}

const theme = createTheme({ cssVariables: true });

function renderTimelineHeader() {
    render(
        <ThemeProvider theme={ theme }>
            <GanttContext.Provider value={ contextValue() as never }>
                <table>
                    <GanttHeader showConstraints />
                </table>
            </GanttContext.Provider>
        </ThemeProvider>,
    );
}

/** The grid's scheduled-hours header row: label cell, then one cell per week. */
const gridScheduledRow = () =>
    within(screen.getByText("זמן משובץ").closest("tr") as HTMLElement).getAllByRole("columnheader");

function pickCourse(name: string) {
    fireEvent.mouseDown(screen.getByRole("combobox", { name: "קורס לחישוב השעות" }));
    fireEvent.click(screen.getByRole("option", { name }));
}

beforeAll(() => {
    Element.prototype.scrollIntoView = vi.fn();
});
beforeEach(() => {
    hoursCourse.set(null);
    setHoursFormat("decimal");
});
afterEach(cleanup);

describe("grid scheduled hours per course (#899)", () => {
    it("regression: shows the busiest course's week, not every course's events summed", () => {
        render(<GanttGridView curriculumId="c1" />);

        // The syllabus row still lists all its events' time...
        expect(within(screen.getByText("סילבוס", { exact: false }).closest("tr") as HTMLElement)
            .getAllByRole("cell").at(-1)?.textContent).toBe("3");
        // ...but no student sits in both: the week is Sphinx's 2h.
        expect(gridScheduledRow().at(-1)?.textContent).toBe("2");
    });

    it("puts the course dropdown inside the scheduled cell and recomputes for the picked course", () => {
        render(<GanttGridView curriculumId="c1" />);
        const label = gridScheduledRow()[ 0 ];
        expect(within(label).getByRole("combobox").textContent).toBe("הקורס העמוס ביותר");

        pickCourse("אפולו");
        expect(gridScheduledRow().at(-1)?.textContent).toBe("1");
        pickCourse("ספינקס");
        expect(gridScheduledRow().at(-1)?.textContent).toBe("2");
    });

    it("puts the dropdown in the folded scheduled / available cell too", () => {
        setGridCompactHeader(true);
        try {
            render(<GanttGridView curriculumId="c1" />);
            pickCourse("אפולו");
            const row = within(screen.getByText("משובץ / זמין").closest("tr") as HTMLElement).getAllByRole("columnheader");
            expect(within(row[ 0 ]).getByRole("combobox")).toBeTruthy();
            expect(row.at(-1)?.textContent).toBe("1 / 8");
        } finally {
            setGridCompactHeader(false);
        }
    });

    it("keeps the grid's arrow keys out of the dropdown", () => {
        render(<GanttGridView curriculumId="c1" />);
        // The opened menu hides the grid from the accessibility tree: query the DOM.
        const current = () => document.querySelector("td[aria-current='true']");
        const before = current();
        fireEvent.keyDown(screen.getByRole("combobox"), { key: "ArrowDown" });
        expect(before).toBeTruthy();
        expect(current()).toBe(before);
    });
});

describe("timeline scheduled hours per course (#899)", () => {
    it("shows the busiest course by default and the picked course's week after", () => {
        renderTimelineHeader();
        expect(screen.getByTestId("gantt-week-hours").textContent).toBe("2 ש׳ / 8 ש׳");

        pickCourse("אפולו");
        expect(screen.getByTestId("gantt-week-hours").textContent).toBe("1 ש׳ / 8 ש׳");
    });

    it("shares the pick with the grid", () => {
        hoursCourse.set("apollo");
        renderTimelineHeader();
        expect(screen.getByRole("combobox", { name: "קורס לחישוב השעות" }).textContent).toBe("אפולו");
        expect(screen.getByTestId("gantt-week-hours").textContent).toBe("1 ש׳ / 8 ש׳");
    });

    it("falls back to the busiest course when the saved one is gone", () => {
        hoursCourse.set("deleted-course");
        renderTimelineHeader();
        expect(screen.getByTestId("gantt-week-hours").textContent).toBe("2 ש׳ / 8 ש׳");
    });
});
