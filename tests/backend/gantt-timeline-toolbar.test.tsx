// @vitest-environment jsdom

import { createTheme, ThemeProvider } from "@mui/material/styles";
import { cleanup, fireEvent, render as rtlRender, screen } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Timeline toolbar (#815, #820): every toggle's accessible name is its visible
 * text, and the block-sizing group keeps its place in the daily view.
 */

vi.mock("@system-b90/command-palette", async (importOriginal) => ({
    ...(await importOriginal<object>()),
    useCommands: () => undefined,
}));
vi.mock(
    "@/components/gantt/curriculum-view/components/syllabuses-actions-box/GanttFilterButton",
    () => ({ GanttFilterButton: () => null }),
);

import {
    GanttToolbar,
    GanttToolbarProps,
} from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/GanttToolbar";

const noop = () => undefined;

const baseProps: GanttToolbarProps = {
    title: "רצף זמן",
    weeklyView: true,
    onWeeklyViewChange: noop,
    showConstraints: true,
    setShowConstraints: noop,
    showUnallocated: false,
    setShowUnallocated: noop,
    unallocatedCount: 3,
    ignoreBreaks: false,
    setIgnoreBreaks: noop,
    relativeDaySizing: false,
    setRelativeDaySizing: noop,
    allCollapsed: false,
    collapseAllSyllabuses: noop,
    expandAllSyllabuses: noop,
    zoomedWeekId: null,
    setZoomedWeekId: noop,
    searchQuery: "",
    onSearchChange: noop,
};

afterEach(cleanup);

const theme = createTheme({ cssVariables: true });
const render = (ui: React.ReactElement) => rtlRender(ui, {
    wrapper: ({ children }) => <ThemeProvider theme={ theme }>{ children }</ThemeProvider>,
});

describe("GanttToolbar", () => {
    it("names each toggle by its visible text (WCAG 2.5.3)", () => {
        render(<GanttToolbar { ...baseProps } />);
        for (const label of [ "שבועי", "יומי", "אילוצים", "ללא הפסקות", "תא מלא", "לפי יום" ]) {
            const button = screen.getByRole("button", { name: label });
            expect(button.textContent).toContain(label);
        }
        // The badge count is part of the text, but the name still starts with nothing hidden.
        const unallocated = screen.getByRole("button", { name: /לא משובצים/ });
        expect(unallocated.getAttribute("aria-label")).toBeNull();
    });

    it("keeps the long explanation as a description, not the name", () => {
        render(<GanttToolbar { ...baseProps } />);
        const breaks = screen.getByRole("button", { name: "ללא הפסקות" });
        expect(breaks.getAttribute("aria-label")).toBeNull();
    });

    it("explains the timeline marks in a legend (#812, #822)", () => {
        render(<GanttToolbar { ...baseProps } />);
        fireEvent.click(screen.getByRole("button", { name: "מקרא" }));
        const legend = screen.getByRole("dialog", { name: "מקרא" });
        expect(legend.textContent).toContain("שעות משובצות / שעות זמינות");
        expect(legend.textContent).toContain("השבוע כולו חורג");
        expect(legend.textContent).toContain("יום שחורג");
    });

    it("keeps the block-sizing group in the daily view, disabled (#820)", () => {
        const { rerender } = render(<GanttToolbar { ...baseProps } />);
        expect((screen.getByRole("button", { name: "תא מלא" }) as HTMLButtonElement).disabled).toBe(false);

        rerender(<GanttToolbar { ...baseProps } weeklyView={ false } />);
        const full = screen.getByRole("button", { name: "תא מלא" }) as HTMLButtonElement;
        const relative = screen.getByRole("button", { name: "לפי יום" }) as HTMLButtonElement;
        expect(full.disabled).toBe(true);
        expect(relative.disabled).toBe(true);
    });
});
