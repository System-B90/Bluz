// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Course } from "@/api-shared/types/course";

/**
 * The context menu's course submenu: nested tree like CourseSelect, a search
 * box with arrow-key hand-off, and tri-state checkboxes over the targets.
 */

const courses: Array<Course> = [
    { id: "a", name: "אפולו", color: null, parentId: null },
    { id: "a1", name: "אפולו א", color: null, parentId: "a" },
    { id: "b", name: "מבצר", color: null, parentId: null },
];

vi.mock("@/components/base/CoursesProvider", () => ({
    useCourses: () => ({ courses }),
}));

import { CourseSubmenu } from "@/components/schedule/event-context-menu/CourseSubmenu";

afterEach(cleanup);

function renderSubmenu(onToggle = vi.fn()) {
    const states = { a: "all", a1: "some", b: "none" } as const;
    render(
        <ul role="menu">
            <CourseSubmenu
                onToggle={onToggle}
                stateOf={(id) => states[id as keyof typeof states]}
            />
        </ul>,
    );
    fireEvent.click(screen.getByText("שיוך מסלולים"));
    return within(screen.getAllByRole("menu").at(-1)!);
}

describe("CourseSubmenu", () => {
    it("lists courses nested with tri-state checkboxes", () => {
        const menu = renderSubmenu();
        const items = menu.getAllByRole("menuitem");
        expect(items.map((i) => i.textContent)).toEqual(["אפולו", "אפולו א", "מבצר"]);
        expect(items.map((i) => i.getAttribute("data-depth"))).toEqual(["0", "1", "0"]);

        const boxes = menu.getAllByRole("checkbox") as Array<HTMLInputElement>;
        expect(boxes.map((b) => b.checked)).toEqual([true, false, false]);
        expect(boxes[1].getAttribute("data-indeterminate")).toBe("true");
    });

    it("filters by search, keeping ancestors", async () => {
        const menu = renderSubmenu();
        await userEvent.type(menu.getByPlaceholderText("חיפוש מסלול..."), "אפולו א");
        expect(menu.getAllByRole("menuitem").map((i) => i.textContent)).toEqual([
            "אפולו",
            "אפולו א",
        ]);
    });

    it("hands focus from the search box to the first row on ArrowDown", () => {
        const menu = renderSubmenu();
        fireEvent.keyDown(menu.getByPlaceholderText("חיפוש מסלול..."), {
            key: "ArrowDown",
        });
        expect(document.activeElement).toBe(menu.getAllByRole("menuitem")[0]);
    });

    it("toggles the clicked course", () => {
        const onToggle = vi.fn();
        const menu = renderSubmenu(onToggle);
        fireEvent.click(menu.getByText("מבצר"));
        expect(onToggle).toHaveBeenCalledWith("b");
    });
});
