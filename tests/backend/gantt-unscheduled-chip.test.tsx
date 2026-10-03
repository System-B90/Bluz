// @vitest-environment jsdom

import { DndContext } from "@dnd-kit/core";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GanttUnscheduledChip } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/GanttUnscheduledChip";

/**
 * An unscheduled module used to be drawn as a scheduled-looking bar over its
 * own name (#817). Its handle now says what it is and how to schedule it.
 */

afterEach(cleanup);

function renderChip(props: Partial<React.ComponentProps<typeof GanttUnscheduledChip>> = {}) {
    const onOpen = vi.fn();
    render(
        <ThemeProvider theme={ createTheme({ cssVariables: true }) }>
            <DndContext>
                <GanttUnscheduledChip
                    moduleId="m1"
                    moduleTitle="גיבוש"
                    onOpen={ onOpen }
                    { ...props }
                />
            </DndContext>
        </ThemeProvider>,
    );
    return { onOpen, chip: screen.getByRole("button", { name: /גיבוש/ }) };
}

describe("GanttUnscheduledChip (#817)", () => {
    it("says it is unscheduled and how to schedule it", () => {
        const { chip } = renderChip();

        expect(chip.textContent).toBe("לא משובץ");
        expect(chip.getAttribute("aria-label")).toBe("גיבוש: לא משובץ — גרור לציר");
    });

    it("keeps the id constraint lines and tests locate the module by", () => {
        const { chip } = renderChip();

        expect(chip.id).toBe("block-module-m1");
    });

    it("opens the module on Enter and on double-click", () => {
        const { chip, onOpen } = renderChip();

        fireEvent.keyDown(chip, { key: "Enter" });
        fireEvent.doubleClick(chip);

        expect(onOpen).toHaveBeenCalledTimes(2);
    });

    it("drops the drag hint when the module can't be dragged", () => {
        const { chip } = renderChip({ disableDrag: true });

        expect(chip.getAttribute("aria-label")).toBe("גיבוש: לא משובץ");
    });
});
