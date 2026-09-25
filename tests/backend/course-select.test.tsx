// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Course } from "@/api-shared/types/course";

/**
 * The reusable course picker: nested rows, search, arrow keys from the search
 * box, single vs multiple selection, subtree and shuffle filtering.
 */

const courses: Array<Course> = [
    { id: "a", name: "אפולו", color: null, parentId: null },
    { id: "a1", name: "אפולו א", color: null, parentId: "a" },
    {
        id: "s",
        name: "שאפל",
        color: null,
        parentId: "a",
        description: 'נגזר מסילבוס "סילבוס"',
    },
    { id: "b", name: "מבצר", color: null, parentId: null },
];

vi.mock("@/components/base/CoursesProvider", () => ({
    useCourses: () => ({
        courses,
        getCourse: (id: string) => courses.find((c) => c.id === id),
    }),
}));

import { CourseSelect } from "@/components/base/CourseSelect";

afterEach(cleanup);

async function open() {
    await userEvent.click(screen.getByRole("combobox"));
    return screen.getByRole("listbox");
}

const optionNames = (listbox: HTMLElement) =>
    within(listbox).getAllByRole("option").map((o) => o.textContent);

describe("CourseSelect", () => {
    it("lists courses nested by depth", async () => {
        render(<CourseSelect onChange={vi.fn()} value="" />);
        const listbox = await open();
        const options = within(listbox).getAllByRole("option");
        expect(options.map((o) => o.textContent)).toEqual([
            "אפולו", "אפולו א", "שאפל", "מבצר",
        ]);
        expect(options.map((o) => o.getAttribute("data-depth"))).toEqual([
            "0", "1", "1", "0",
        ]);
    });

    it("hides shuffle-courses when showShuffles is false", async () => {
        render(<CourseSelect onChange={vi.fn()} showShuffles={false} value="" />);
        expect(optionNames(await open())).not.toContain("שאפל");
    });

    it("limits to courses under rootId", async () => {
        render(<CourseSelect onChange={vi.fn()} rootId="a" value="" />);
        expect(optionNames(await open())).toEqual(["אפולו א", "שאפל"]);
    });

    it("filters by search text, keeping ancestors", async () => {
        render(<CourseSelect onChange={vi.fn()} value="" />);
        const listbox = await open();
        await userEvent.type(screen.getByPlaceholderText("חיפוש מסלול..."), "אפולו א");
        expect(optionNames(listbox)).toEqual(["אפולו", "אפולו א"]);
    });

    it("moves focus from the search box into the list with arrow keys", async () => {
        render(<CourseSelect onChange={vi.fn()} value="" />);
        const listbox = await open();
        const search = screen.getByPlaceholderText("חיפוש מסלול...");
        const options = within(listbox).getAllByRole("option");

        fireEvent.keyDown(search, { key: "ArrowDown" });
        expect(document.activeElement).toBe(options[0]);

        search.focus();
        fireEvent.keyDown(search, { key: "ArrowUp" });
        expect(document.activeElement).toBe(options[options.length - 1]);
    });

    it("emits a single id in single mode", async () => {
        const onChange = vi.fn();
        render(<CourseSelect onChange={onChange} value="" />);
        const listbox = await open();
        await userEvent.click(within(listbox).getByText("מבצר"));
        expect(onChange).toHaveBeenCalledWith("b");
    });

    it("emits an id array with checkboxes in multiple mode", async () => {
        const onChange = vi.fn();
        render(<CourseSelect multiple onChange={onChange} value={["a"]} />);
        expect(screen.getByRole("combobox").textContent).toContain("אפולו");
        const listbox = await open();
        expect(within(listbox).getAllByRole("checkbox")).toHaveLength(4);
        await userEvent.click(within(listbox).getByText("מבצר"));
        expect(onChange).toHaveBeenCalledWith(["a", "b"]);
    });
});
