// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Spreadsheet grid tab: blank summary cells, required/allocated columns,
 * keyboard navigation (arrows in RTL, Enter toggles/opens), week
 * used/available header, conflict tint, and decimal/clock hours.
 */

const { ctx, actions } = vi.hoisted(() => ({
    ctx: {
        expanded: new Set<string>(),
        placedDayIds: [ "a1" ],
        courses: [] as Array<{ id: string; name: string; color: null | string; parentId: null | string }>,
    },
    actions: {
        toggleSyllabus: vi.fn(),
        toggleModule: vi.fn(),
        openEventDialog: vi.fn(),
        openModuleDialog: vi.fn(),
        openSyllabusDialog: vi.fn(),
        commitWeek: vi.fn(),
    },
}));

const state = {
    days: {
        a1: { id: "a1", dayIndex: 0, totalWorkingMinutes: 60 },
        b1: { id: "b1", dayIndex: 0, totalWorkingMinutes: 480 },
    },
    syllabuses: { s1: { id: "s1", title: "סילבוס", modules: [ "m1" ] } },
    modules: { m1: { id: "m1", title: "מודול", syllabusId: "s1", events: [ "e1" ] } },
    events: { e1: { id: "e1", title: "אירוע", minimumDuration: 90, recurrence: "none" } },
};

vi.mock("@/components/gantt/state/context", () => ({
    useCurriculumState: () => state,
    useCurriculumProviderActions: () => ({
        openEventDialog: actions.openEventDialog,
        openModuleDialog: actions.openModuleDialog,
        openSyllabusDialog: actions.openSyllabusDialog,
    }),
}));

vi.mock("@/components/base/CoursesProvider", () => ({
    useCourses: () => ({ courses: ctx.courses }),
}));

vi.mock("notistack", () => ({ useSnackbar: () => ({ enqueueSnackbar: vi.fn() }) }));

vi.mock("@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/use-grid-allotment", () => ({
    useGridAllotment: () => ({ commitWeek: actions.commitWeek, dialog: null }),
}));

vi.mock("@/components/gantt/state/recurrence-exceptions/hooks", () => ({
    useGanttRecurrenceExceptions: () => ({ state: { exceptions: {} } }),
}));

vi.mock("@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/UseGanttView", () => ({
    useGanttView: () => ({
        curriculum: { syllabuses: [ "s1" ] },
        contextValue: {
            allLinearDays: [ "a1", "b1" ],
            curriculumMappings: { x: { eventId: "e1", moduleId: "m1", dayId: "a1", sortOrder: 0 } },
            dateOfDayId: () => undefined,
            eventSpans: {
                e1: { dayIds: ctx.placedDayIds, minutesPerDay: ctx.placedDayIds.map(() => 90), spillover: false },
            },
            isModuleExpanded: (id: string) => ctx.expanded.has(id),
            isSyllabusExpanded: (id: string) => ctx.expanded.has(id),
            timelineWeeks: [ { id: "w1", title: "שבוע 1", days: [ "a1" ] }, { id: "w2", title: "שבוע 2", days: [ "b1" ] } ],
            toggleModule: actions.toggleModule,
            toggleSyllabus: actions.toggleSyllabus,
            weekIndexByDayId: new Map([ [ "a1", 0 ], [ "b1", 1 ] ]),
        },
    }),
}));

import { setHoursFormat } from "@/components/gantt/curriculum-view/gantt-time-utils";
import { setGridCompactHeader } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/grid-preferences";
import { GanttGridView } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/GanttGridView";

beforeAll(() => {
    Element.prototype.scrollIntoView = vi.fn();
});
beforeEach(() => {
    ctx.expanded = new Set([ "s1", "m1" ]);
    ctx.placedDayIds = [ "a1" ];
    ctx.courses = [];
    setHoursFormat("decimal");
    vi.clearAllMocks();
});
afterEach(cleanup);

const renderGrid = () => {
    render(<GanttGridView curriculumId="c1" />);
    return screen.getByRole("grid");
};
const rowCells = (title: string) =>
    within(screen.getByText(title, { exact: false }).closest("tr") as HTMLElement).getAllByRole("cell");
const selectedText = () =>
    screen.getAllByRole("cell").find((c) => c.getAttribute("aria-current") === "true")?.textContent?.trim();
const selectedCount = () => screen.getAllByRole("cell").filter((c) => c.getAttribute("aria-selected") === "true").length;

describe("GanttGridView", () => {
    it("shows required, allocated and per-week hours, blank for empty weeks", () => {
        renderGrid();
        for (const title of [ "סילבוס", "מודול", "אירוע" ]) {
            expect(rowCells(title).slice(1).map((c) => c.textContent)).toEqual([ "1.5", "1.5", "1.5", "" ]);
        }
    });

    it("hides collapsed children", () => {
        ctx.expanded = new Set();
        renderGrid();
        expect(screen.queryByText("מודול", { exact: false })).toBeNull();
    });

    it("moves the selection with arrows, ArrowLeft forward in RTL", () => {
        const grid = renderGrid();
        expect(selectedText()).toContain("סילבוס");
        fireEvent.keyDown(grid, { key: "ArrowDown" });
        fireEvent.keyDown(grid, { key: "ArrowDown" });
        expect(selectedText()).toContain("אירוע");
        fireEvent.keyDown(grid, { key: "ArrowLeft" });
        fireEvent.keyDown(grid, { key: "ArrowLeft" });
        fireEvent.keyDown(grid, { key: "ArrowLeft" });
        expect(selectedText()).toBe("1.5");
        fireEvent.keyDown(grid, { key: "End" });
        expect(selectedText()).toBe("");
        fireEvent.keyDown(grid, { key: "ArrowRight" });
        expect(selectedText()).toBe("1.5");
        fireEvent.keyDown(grid, { key: "ArrowDown" });
        fireEvent.keyDown(grid, { key: "Home" });
        expect(selectedText()).toContain("אירוע");
    });

    it("extends a range with Shift+arrows and Shift+click, adds cells with Ctrl+click", () => {
        const grid = renderGrid();
        fireEvent.keyDown(grid, { key: "ArrowDown", shiftKey: true });
        fireEvent.keyDown(grid, { key: "ArrowLeft", shiftKey: true });
        expect(selectedCount()).toBe(4);
        fireEvent.keyDown(grid, { key: "ArrowDown" });
        expect(selectedCount()).toBe(1);
        const [ , required, , week1 ] = rowCells("סילבוס");
        fireEvent.click(required);
        fireEvent.click(rowCells("אירוע")[ 3 ], { shiftKey: true });
        expect(selectedCount()).toBe(9);
        fireEvent.click(week1, { ctrlKey: true });
        expect(selectedCount()).toBe(8);
        fireEvent.click(rowCells("אירוע")[ 4 ], { ctrlKey: true });
        expect(selectedCount()).toBe(9);
        expect(selectedText()).toBe("");
    });

    it("opens each row's dialog on Enter and toggles summary rows on Space", () => {
        const grid = renderGrid();
        fireEvent.keyDown(grid, { key: "Enter" });
        expect(actions.openSyllabusDialog).toHaveBeenCalledWith("s1");
        expect(actions.toggleSyllabus).not.toHaveBeenCalled();
        fireEvent.keyDown(grid, { key: " " });
        expect(actions.toggleSyllabus).toHaveBeenCalledWith("s1");
        fireEvent.keyDown(grid, { key: "ArrowDown" });
        fireEvent.keyDown(grid, { key: "Enter" });
        expect(actions.openModuleDialog).toHaveBeenCalledWith("s1", "m1");
        fireEvent.keyDown(grid, { key: " " });
        expect(actions.toggleModule).toHaveBeenCalledWith("m1");
        fireEvent.keyDown(grid, { key: "ArrowDown" });
        fireEvent.keyDown(grid, { key: "Enter" });
        expect(actions.openEventDialog).toHaveBeenCalledWith("s1", "m1", "e1");
    });

    it("toggles a summary row on a double-click anywhere in it, once", () => {
        renderGrid();
        const cells = screen.getAllByRole("row").filter((r) => r.textContent?.includes("סילבוס"))[ 0 ].querySelectorAll("td");
        fireEvent.doubleClick(cells[ cells.length - 1 ]);
        expect(actions.toggleSyllabus).toHaveBeenCalledTimes(1);
        fireEvent.doubleClick(screen.getByText(/סילבוס/));
        expect(actions.toggleSyllabus).toHaveBeenCalledTimes(2);
    });

    it("expands on + and collapses on -, only when the state differs", () => {
        const grid = renderGrid();
        const open = actions.toggleSyllabus.mock.calls.length;
        // The syllabus starts expanded: + does nothing, - collapses it.
        fireEvent.keyDown(grid, { key: "+" });
        expect(actions.toggleSyllabus).toHaveBeenCalledTimes(open);
        fireEvent.keyDown(grid, { key: "-" });
        expect(actions.toggleSyllabus).toHaveBeenCalledTimes(open + 1);
    });

    it("shows available and allocated hours per week in labelled header rows", () => {
        renderGrid();
        const header = screen.getAllByRole("row").slice(0, 3).map((row) =>
            within(row).getAllByRole("columnheader").map((c) => c.textContent));
        expect(header).toEqual([
            [ "שם", "נדרש", "שובץ", "שבוע 1", "שבוע 2" ],
            [ "זמן זמין", "1", "8" ],
            [ "זמן משובץ", "1.5", "0" ],
        ]);
    });

    it("tints required and allocated only when they differ", () => {
        renderGrid();
        expect(screen.queryAllByTitle("השיבוץ שונה מהנדרש")).toHaveLength(0);
        cleanup();
        ctx.placedDayIds = [ "a1", "b1" ];
        renderGrid();
        expect(rowCells("אירוע").slice(1, 3).map((c) => c.getAttribute("title"))).toEqual([
            "השיבוץ שונה מהנדרש",
            "השיבוץ שונה מהנדרש",
        ]);
        expect(rowCells("אירוע")[ 3 ].getAttribute("title")).toBeNull();
    });

    it("folds the available and allocated header rows into one allotted / available row", () => {
        setGridCompactHeader(true);
        try {
            renderGrid();
            const header = screen.getAllByRole("row").slice(0, 2).map((row) =>
                within(row).getAllByRole("columnheader").map((c) => c.textContent));
            expect(header).toEqual([
                [ "שם", "נדרש", "שובץ", "שבוע 1", "שבוע 2" ],
                [ "משובץ / זמין", "1.5 / 1", "0 / 8" ],
            ]);
        } finally {
            setGridCompactHeader(false);
        }
    });

    it("shows a course column per leaf course, grouped under its parent, filled by attendance", () => {
        ctx.courses = [
            { id: "root", name: "ביס90", color: null, parentId: null },
            { id: "apollo", name: "אפולו", color: "rgb(255, 0, 0)", parentId: "root" },
            { id: "a1", name: "צוות א", color: null, parentId: "apollo" },
            { id: "a2", name: "צוות ב", color: null, parentId: "apollo" },
            { id: "mivtzar", name: "מבצר", color: "rgb(0, 0, 255)", parentId: "root" },
        ];
        renderGrid();
        const [ top, sub ] = screen.getAllByRole("row");
        const topCells = within(top).getAllByRole("columnheader");
        expect(topCells.slice(0, 2).map((c) => [ c.textContent, c.getAttribute("colspan") ])).toEqual([
            [ "אפולו", "2" ],
            [ "מבצר", "1" ],
        ]);
        expect(within(sub).getAllByRole("columnheader").slice(0, 2).map((c) => c.textContent)).toEqual([ "צוות א", "צוות ב" ]);
        // Whole-syllabus event: every course attends.
        const eventRow = screen.getByText("אירוע", { exact: false }).closest("tr") as HTMLElement;
        expect([ ...eventRow.querySelectorAll("[data-presence]") ].map((c) => c.getAttribute("data-presence")))
            .toEqual([ "full", "full", "full" ]);
        expect([ ...eventRow.querySelectorAll("[data-presence]") ].map((c) => c.textContent)).toEqual([ "1", "1", "1" ]);
        // RTL: ArrowRight walks from the title into the course columns, Shift extends over them.
        const grid = screen.getByRole("grid");
        fireEvent.keyDown(grid, { key: "ArrowRight" });
        expect(selectedText()).toBe("1");
        fireEvent.keyDown(grid, { key: "Home", shiftKey: true });
        expect(selectedCount()).toBe(3);
        fireEvent.keyDown(grid, { key: "Home" });
        expect(screen.getAllByRole("cell")[ 0 ].getAttribute("aria-current")).toBe("true");
    });

    it("edits an event's week cell and commits the typed hours on blur", () => {
        const grid = renderGrid();
        fireEvent.keyDown(grid, { key: "ArrowDown" });
        fireEvent.keyDown(grid, { key: "ArrowDown" });
        for (let i = 0; i < 4; i++) fireEvent.keyDown(grid, { key: "ArrowLeft" });
        fireEvent.keyDown(grid, { key: "2" });
        const input = screen.getByLabelText("שעות בשבוע") as HTMLInputElement;
        expect(input.value).toBe("2");
        fireEvent.change(input, { target: { value: "2:30" } });
        fireEvent.blur(input);
        expect(actions.commitWeek).toHaveBeenCalledWith("e1", "m1", 1, 150);
        expect(screen.queryByLabelText("שעות בשבוע")).toBeNull();
    });

    it("cancels on Escape, ignores unchanged values and leaves sums and totals read-only", () => {
        const grid = renderGrid();
        const week1 = rowCells("אירוע")[ 3 ];
        fireEvent.doubleClick(week1);
        const input = screen.getByLabelText("שעות בשבוע");
        fireEvent.change(input, { target: { value: "5" } });
        fireEvent.keyDown(input, { key: "Escape" });
        fireEvent.doubleClick(week1);
        fireEvent.blur(screen.getByLabelText("שעות בשבוע"));
        expect(actions.commitWeek).not.toHaveBeenCalled();
        // Summary week cell, the event's required/allocated cells, and the title don't edit.
        fireEvent.doubleClick(rowCells("מודול")[ 3 ]);
        fireEvent.doubleClick(rowCells("אירוע")[ 1 ]);
        fireEvent.doubleClick(rowCells("אירוע")[ 2 ]);
        expect(screen.queryByLabelText("שעות בשבוע")).toBeNull();
        expect(rowCells("אירוע")[ 2 ].getAttribute("aria-readonly")).toBe("true");
        expect(week1.getAttribute("aria-readonly")).toBeNull();
        // Delete clears a week to 0.
        fireEvent.click(week1);
        fireEvent.keyDown(grid, { key: "Delete" });
        expect(actions.commitWeek).toHaveBeenCalledWith("e1", "m1", 0, 0);
    });

    it("switches every hour value to clock format", () => {
        renderGrid();
        act(() => setHoursFormat("clock"));
        expect(rowCells("אירוע").slice(1).map((c) => c.textContent)).toEqual([ "1:30", "1:30", "1:30", "" ]);
        act(() => setHoursFormat("decimal"));
        expect(rowCells("אירוע")[ 1 ].textContent).toBe("1.5");
    });
});
