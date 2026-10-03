// @vitest-environment jsdom

import { DndContext } from "@dnd-kit/core";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
    countHiddenBelow,
    GanttUnallocatedGroup,
    GanttUnallocatedPanel,
} from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/GanttUnallocatedPanel";

/**
 * The "לא משובצים" panel (#818): modules and events told apart by more than
 * colour, look-alike event names disambiguated by their module, and overflow
 * past the panel's cap announced instead of silently clipped.
 */

afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
});

const group: GanttUnallocatedGroup = {
    syllabusId: "s1",
    syllabusTitle: "גיבוש",
    modules: [ { id: "m1", title: "משחקים" } ],
    events: [
        { id: "e1", title: "שעת מק\"ס", moduleId: "m2", moduleTitle: "מק\"ס" },
        { id: "e2", title: "שעות מק\"ס", moduleId: "m3", moduleTitle: "סיכום" },
    ],
};

function renderPanel(groups: Array<GanttUnallocatedGroup> = [ group ]) {
    const onReveal = vi.fn();
    render(
        <ThemeProvider theme={ createTheme({ cssVariables: true }) }>
            <DndContext>
                <GanttUnallocatedPanel onReveal={ onReveal } unallocatedBySyllabus={ groups } />
            </DndContext>
        </ThemeProvider>,
    );
    return { onReveal };
}

describe("GanttUnallocatedPanel (#818)", () => {
    it("heads modules and events separately", () => {
        renderPanel();

        expect(screen.getByText("מערכים")).toBeTruthy();
        expect(screen.getByText("מפגשים")).toBeTruthy();
    });

    it("gives each kind its own icon, not just a colour", () => {
        renderPanel();

        const moduleChip = document.querySelector('[data-unallocated-chip="module"]') as HTMLElement;
        const eventChip = document.querySelector('[data-unallocated-chip="event"]') as HTMLElement;
        expect(within(moduleChip).getByTestId("FolderOutlinedIcon")).toBeTruthy();
        expect(within(eventChip).getByTestId("EventOutlinedIcon")).toBeTruthy();
    });

    it("shows an event chip's module path on hover, keeping its visible name", async () => {
        renderPanel();

        const chip = screen.getByRole("button", { name: "שעת מק\"ס" });
        fireEvent.mouseOver(chip);

        expect((await screen.findByRole("tooltip")).textContent).toBe("מק\"ס › שעת מק\"ס");
        expect(chip.getAttribute("aria-label")).toBeNull();
    });

    it("still reveals the item on click", () => {
        const { onReveal } = renderPanel();

        fireEvent.click(screen.getByRole("button", { name: "שעות מק\"ס" }));

        expect(onReveal).toHaveBeenCalledWith("s1", "m3", "e2");
    });

    it("shows no overflow hint when everything fits", () => {
        renderPanel();

        expect(screen.queryByTestId("unallocated-more")).toBeNull();
    });

    it("counts the chips below the fold and says so", () => {
        // jsdom has no layout: put the panel's bottom at 100 and every
        // event chip below it.
        vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
            const bottom = this.dataset.testid === "unallocated-panel-scroll"
                ? 100
                : this.dataset.unallocatedChip === "event" ? 150 : 50;
            return { bottom, top: bottom - 20, left: 0, right: 0, width: 0, height: 20, x: 0, y: 0, toJSON: () => ({}) };
        });

        renderPanel();
        act(() => {
            fireEvent.scroll(screen.getByTestId("unallocated-panel-scroll"));
        });

        expect(screen.getByTestId("unallocated-more").textContent).toBe("ועוד 2 ↓");
    });
});

describe("countHiddenBelow", () => {
    it("ignores a chip that ends exactly at the fold", () => {
        const container = document.createElement("div");
        const chip = document.createElement("span");
        chip.dataset.unallocatedChip = "event";
        container.appendChild(chip);
        container.getBoundingClientRect = () => ({ bottom: 100 }) as DOMRect;
        chip.getBoundingClientRect = () => ({ bottom: 100.5 }) as DOMRect;

        expect(countHiddenBelow(container)).toBe(0);
    });
});
