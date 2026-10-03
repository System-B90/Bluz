// @vitest-environment jsdom

import { DndContext } from "@dnd-kit/core";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import {
    GanttUnallocatedPanel,
    UNALLOCATED_PANEL_MAX_HEIGHT,
} from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/GanttUnallocatedPanel";

/**
 * On a ~735px-tall laptop viewport the unallocated panel took 200px and left
 * about four timeline rows (#819). It is now capped relative to the viewport
 * and can be dragged taller.
 */

afterEach(cleanup);

describe("GanttUnallocatedPanel height (#819)", () => {
    it("caps at the smaller of 200px and 22% of the viewport", () => {
        expect(UNALLOCATED_PANEL_MAX_HEIGHT).toBe("min(200px, 22vh)");
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
