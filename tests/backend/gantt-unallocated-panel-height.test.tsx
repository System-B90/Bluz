// @vitest-environment jsdom

import { DndContext } from "@dnd-kit/core";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import {
    GanttUnallocatedPanel,
    UNALLOCATED_PANEL_MIN_WIDTH,
    UNALLOCATED_PANEL_WIDTH,
} from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/GanttUnallocatedPanel";

/**
 * On a ~735px-tall laptop viewport the unallocated panel took 200px above the
 * rows and left about four of them (#819). It is now a side drawer beside the
 * rows (#882), which costs width instead of rows and can be dragged wider.
 */

afterEach(cleanup);

describe("GanttUnallocatedPanel side drawer (#819, #882)", () => {
    it("is a fixed-width drawer that can grow wider, not a band above the rows", () => {
        expect(UNALLOCATED_PANEL_WIDTH).toBeGreaterThanOrEqual(UNALLOCATED_PANEL_MIN_WIDTH);
    });

    it("is a labelled landmark", () => {
        render(
            <ThemeProvider theme={ createTheme({ cssVariables: true }) }>
                <DndContext>
                    <GanttUnallocatedPanel onReveal={ () => undefined } unallocatedBySyllabus={ [] } />
                </DndContext>
            </ThemeProvider>,
        );
        expect(screen.getByRole("complementary", { name: "לא משובצים" })).toBeTruthy();
    });

    it("renders the empty state with the gantt's own word for events", () => {
        render(
            <ThemeProvider theme={ createTheme({ cssVariables: true }) }>
                <DndContext>
                    <GanttUnallocatedPanel onReveal={ () => undefined } unallocatedBySyllabus={ [] } />
                </DndContext>
            </ThemeProvider>,
        );
        expect(screen.getByText(/כל המערכים והמופעים משובצים/)).toBeTruthy();
    });
});
