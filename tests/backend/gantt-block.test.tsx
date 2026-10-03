// @vitest-environment jsdom

import { DndContext } from "@dnd-kit/core";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { state, actions, exceptions } = vi.hoisted(() => ({
    state: {
        syllabuses: { s1: { id: "s1", title: "גיבוש" } },
        modules: { m1: { id: "m1", title: "קפ\"ה שבוע 1", syllabusId: "s1", events: [ "e1" ] } },
        events: { e1: { id: "e1", title: "גיבוש פתיחה ארוך מאוד", minimumDuration: 90 } },
    },
    actions: { openModuleDialog: vi.fn(), openEventDialog: vi.fn() },
    exceptions: {
        materializeOccurrence: vi.fn(async () => ({ event: { id: "e9" } })),
        restoreOccurrence: vi.fn(),
    },
}));

vi.mock("@/components/gantt/state/context", () => ({
    useCurriculumState: () => state,
    useCurriculumProviderActions: () => actions,
}));
vi.mock("@/components/gantt/state/recurrence-exceptions/hooks", () => ({
    useGanttRecurrenceExceptions: () => exceptions,
}));

import { buildBlockTooltip } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/block-tooltip";
import { GanttBlock } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/GanttBlock";
import { GanttBlockProps } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/types";

afterEach(() => {
    cleanup();
    vi.clearAllMocks();
});

function renderBlock(props: Partial<GanttBlockProps> = {}) {
    render(
        <ThemeProvider theme={ createTheme({ cssVariables: true }) }>
            <DndContext>
                <GanttBlock
                    id="drag-event-move-e1-d1"
                    payload={ { type: "event-move", moduleId: "m1", eventId: "e1", sourceDayId: "d1" } }
                    title="גיבוש פתיחה ארוך מאוד"
                    { ...props }
                />
            </DndContext>
        </ThemeProvider>,
    );
    return screen.getAllByRole("button")[ 0 ];
}

describe("buildBlockTooltip (#828)", () => {
    it("lists name, path and hours, one per line", () => {
        expect(buildBlockTooltip({
            title: "שיעור",
            path: [ "גיבוש", "קפ\"ה" ],
            hoursLabel: "1.5 ש׳",
            notes: [ "", "מופע חוזר" ],
        })).toBe("שיעור\nגיבוש › קפ\"ה\n1.5 ש׳\nמופע חוזר");
    });

    it("skips missing parts", () => {
        expect(buildBlockTooltip({ title: "שיעור", path: [ undefined ] })).toBe("שיעור");
    });
});

describe("GanttBlock tooltip (#828)", () => {
    it("names an event bar's full title, module path and hours", async () => {
        const block = renderBlock();

        fireEvent.mouseOver(block);

        const tip = await screen.findByRole("tooltip");
        expect(tip.textContent).toContain("גיבוש פתיחה ארוך מאוד");
        expect(tip.textContent).toContain("גיבוש › קפ\"ה שבוע 1");
        expect(tip.textContent).toMatch(/1[.:]5|1:30/);
    });

    it("uses the hours a module row passes in", async () => {
        const block = renderBlock({
            id: "drag-module-shift-m1-d1",
            payload: { type: "module-shift", moduleId: "m1", sourceDayId: "d1" },
            title: "קפ\"ה שבוע 1",
            minutes: 120,
        });

        fireEvent.mouseOver(block);

        const tip = await screen.findByRole("tooltip");
        expect(tip.textContent).toContain("גיבוש");
        expect(tip.textContent).not.toContain("›");
        expect(tip.textContent).toMatch(/2/);
    });
});

describe("GanttBlock opening (#833)", () => {
    const occurrence = {
        id: "drag-occ-e1-d3",
        payload: { type: "event-occurrence", moduleId: "m1", eventId: "e1", dayId: "d3" } as const,
        isRecurrence: true,
    };

    it("opens a bar's dialog with Enter", () => {
        const block = renderBlock();

        fireEvent.keyDown(block, { key: "Enter" });

        expect(actions.openEventDialog).toHaveBeenCalledWith("s1", "m1", "e1");
    });

    it("opens a module bar with Enter", () => {
        const block = renderBlock({
            id: "drag-module-shift-m1-d1",
            payload: { type: "module-shift", moduleId: "m1", sourceDayId: "d1" },
        });

        fireEvent.keyDown(block, { key: "Enter" });

        expect(actions.openModuleDialog).toHaveBeenCalledWith("s1", "m1");
    });

    it("regression: double-clicking an occurrence changes nothing, it asks", async () => {
        const block = renderBlock(occurrence);

        fireEvent.doubleClick(block);

        expect(await screen.findByRole("menu")).toBeTruthy();
        expect(exceptions.materializeOccurrence).not.toHaveBeenCalled();
        expect(actions.openEventDialog).not.toHaveBeenCalled();
    });

    it("opens the recurring series without materializing", async () => {
        const block = renderBlock(occurrence);
        fireEvent.keyDown(block, { key: "Enter" });

        fireEvent.click(await screen.findByText("פתיחת האירוע החוזר"));

        expect(exceptions.materializeOccurrence).not.toHaveBeenCalled();
        expect(actions.openEventDialog).toHaveBeenCalledWith("s1", "m1", "e1");
    });

    it("materializes only when asked to edit just this occurrence", async () => {
        const block = renderBlock(occurrence);
        fireEvent.doubleClick(block);

        fireEvent.click(await screen.findByText("עריכת מופע זה בלבד"));

        await vi.waitFor(() =>
            expect(actions.openEventDialog).toHaveBeenCalledWith("s1", "m1", "e9"),
        );
        expect(exceptions.materializeOccurrence).toHaveBeenCalledWith({
            moduleId: "m1",
            eventId: "e1",
            dayId: "d3",
        });
    });
});
