// @vitest-environment jsdom

import { DndContext } from "@dnd-kit/core";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { GanttContext } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/context";
import { GanttCell } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/GanttCell";

/**
 * A timeline day cell at rest. There are hundreds of them, so anything they
 * carry while idle is paid for on every drag-driven render.
 */

afterEach(cleanup);

function renderCell() {
    const ctx = { dayCellWidth: 40, getDropWarning: () => null };
    return render(
        <ThemeProvider theme={ createTheme({ cssVariables: true }) }>
            <DndContext>
                <GanttContext.Provider value={ ctx as never }>
                    <table>
                        <tbody>
                            <tr>
                                <GanttCell
                                    dayId="d1"
                                    dropId="drop-d1"
                                    payloadData={ { targetType: "event", moduleId: "m1", dayId: "d1" } }
                                />
                            </tr>
                        </tbody>
                    </table>
                </GanttContext.Provider>
            </DndContext>
        </ThemeProvider>,
    );
}

describe("GanttCell at rest (#831)", () => {
    it("carries no background transition while nothing hovers it", () => {
        const { container } = renderCell();
        const cell = container.querySelector("td")!;

        expect(getComputedStyle(cell).transition).toBe("");
    });
});
