// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useGanttExpansion } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/use-gantt-expansion";

/** Rows open on search but stay collapsible while it is active. */

const syllabusIds = ["s1", "s2"];

function setup(searchActive = false) {
    return renderHook(
        ({ search }) => useGanttExpansion(syllabusIds, search),
        { initialProps: { search: searchActive } },
    );
}

describe("useGanttExpansion", () => {
    it("toggles without a search", () => {
        const { result } = setup();
        expect(result.current.isSyllabusExpanded("s1")).toBe(true);
        expect(result.current.isModuleExpanded("m1")).toBe(false);
        act(() => result.current.toggleSyllabus("s1"));
        act(() => result.current.toggleModule("m1"));
        expect(result.current.isSyllabusExpanded("s1")).toBe(false);
        expect(result.current.isModuleExpanded("m1")).toBe(true);
    });

    it("opens everything when a search starts", () => {
        const { result, rerender } = setup();
        act(() => result.current.toggleSyllabus("s1"));
        rerender({ search: true });
        expect(result.current.isSyllabusExpanded("s1")).toBe(true);
        expect(result.current.isModuleExpanded("m1")).toBe(true);
    });

    it("collapses syllabuses and modules while searching", () => {
        const { result } = setup(true);
        act(() => result.current.toggleSyllabus("s1"));
        act(() => result.current.toggleModule("m1"));
        expect(result.current.isSyllabusExpanded("s1")).toBe(false);
        expect(result.current.isModuleExpanded("m1")).toBe(false);
        act(() => result.current.toggleModule("m1"));
        expect(result.current.isModuleExpanded("m1")).toBe(true);
    });

    it("collapses and expands all while searching", () => {
        const { result } = setup(true);
        act(() => result.current.collapseAllSyllabuses());
        expect(result.current.allCollapsed).toBe(true);
        act(() => result.current.expandAllSyllabuses());
        expect(result.current.allCollapsed).toBe(false);
    });

    it("restores pre-search state when the search clears", () => {
        const { result, rerender } = setup();
        act(() => result.current.toggleSyllabus("s2"));
        rerender({ search: true });
        act(() => result.current.toggleSyllabus("s1"));
        rerender({ search: false });
        expect(result.current.isSyllabusExpanded("s1")).toBe(true);
        expect(result.current.isSyllabusExpanded("s2")).toBe(false);
        rerender({ search: true });
        expect(result.current.isSyllabusExpanded("s1")).toBe(true);
    });

    it("reveal re-opens a row collapsed during search", () => {
        const { result } = setup(true);
        act(() => result.current.toggleModule("m1"));
        act(() => result.current.expandModuleFor("m1"));
        expect(result.current.isModuleExpanded("m1")).toBe(true);
    });
});
