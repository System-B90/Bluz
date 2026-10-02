// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Spreadsheet grid tab: blank summary cells, required/allocated columns,
 * and keyboard navigation (arrows in RTL, Enter toggles/opens).
 */

const { ctx, actions } = vi.hoisted(() => ({
    ctx: { expanded: new Set<string>() },
    actions: { toggleSyllabus: vi.fn(), toggleModule: vi.fn(), openEventDialog: vi.fn() },
}));

const state = {
    days: { a1: { id: "a1", dayIndex: 0 }, b1: { id: "b1", dayIndex: 0 } },
    syllabuses: { s1: { id: "s1", title: "סילבוס", modules: [ "m1" ] } },
    modules: { m1: { id: "m1", title: "מודול", syllabusId: "s1", events: [ "e1" ] } },
    events: { e1: { id: "e1", title: "אירוע", minimumDuration: 90, recurrence: "none" } },
};

vi.mock("@/components/gantt/state/context", () => ({
    useCurriculumState: () => state,
    useCurriculumProviderActions: () => ({ openEventDialog: actions.openEventDialog }),
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
            eventSpans: { e1: { dayIds: [ "a1" ], minutesPerDay: [ 90 ], spillover: false } },
            isModuleExpanded: (id: string) => ctx.expanded.has(id),
            isSyllabusExpanded: (id: string) => ctx.expanded.has(id),
            timelineWeeks: [ { id: "w1", title: "שבוע 1", days: [ "a1" ] }, { id: "w2", title: "שבוע 2", days: [ "b1" ] } ],
            toggleModule: actions.toggleModule,
            toggleSyllabus: actions.toggleSyllabus,
            weekIndexByDayId: new Map([ [ "a1", 0 ], [ "b1", 1 ] ]),
        },
    }),
}));

import { GanttGridView } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/GanttGridView";

beforeAll(() => {
    Element.prototype.scrollIntoView = vi.fn();
});
beforeEach(() => {
    ctx.expanded = new Set([ "s1", "m1" ]);
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
    screen.getAllByRole("cell").find((c) => c.getAttribute("aria-selected") === "true")?.textContent?.trim();

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

    it("toggles a summary row and opens an event on Enter", () => {
        const grid = renderGrid();
        fireEvent.keyDown(grid, { key: "Enter" });
        expect(actions.toggleSyllabus).toHaveBeenCalledWith("s1");
        fireEvent.keyDown(grid, { key: "ArrowDown" });
        fireEvent.keyDown(grid, { key: " " });
        expect(actions.toggleModule).toHaveBeenCalledWith("m1");
        fireEvent.keyDown(grid, { key: "ArrowDown" });
        fireEvent.keyDown(grid, { key: "Enter" });
        expect(actions.openEventDialog).toHaveBeenCalledWith("s1", "m1", "e1");
    });
});
