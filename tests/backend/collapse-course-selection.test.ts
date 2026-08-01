import { describe, expect, it } from "vitest";

import { Course, CourseId } from "@/api-shared/types/course";
import { collapseCourseSelection } from "@/components/base/collapse-course-selection";

/**
 * Unit tests for the course-selection roll-up used by the schedule event tags.
 *
 * Rule under test: a course displays only if it is the *highest* covered node
 * of its branch, where "covered" means selected, or every child is covered.
 */

function course(id: string, parentId?: string): Course {
    return { id, name: id, color: null, parentId: parentId ?? null };
}

/**
 * Tree used by most cases:
 *
 *   a ── a1 ── a1x
 *     │     └─ a1y
 *     └─ a2
 *   b ── b1
 *   c            (leaf root, no children)
 */
const tree: Array<Course> = [
    course("a"),
    course("a1", "a"),
    course("a1x", "a1"),
    course("a1y", "a1"),
    course("a2", "a"),
    course("b"),
    course("b1", "b"),
    course("c"),
];

const names = (selected: Array<CourseId>, all: Array<Course> = tree) =>
    collapseCourseSelection(selected, all).map((c) => c.id);

describe("collapseCourseSelection", () => {
    // ─── Degenerate inputs ──────────────────────────────────────────────────

    it("returns nothing for an empty selection", () => {
        expect(names([])).toEqual([]);
    });

    it("returns nothing when the course list is empty", () => {
        expect(names(["a"], [])).toEqual([]);
    });

    it("drops ids that match no known course", () => {
        expect(names(["ghost"])).toEqual([]);
        expect(names(["ghost", "c"])).toEqual(["c"]);
    });

    it("ignores duplicate ids in the selection", () => {
        expect(names(["c", "c", "c"])).toEqual(["c"]);
    });

    // ─── No roll-up ─────────────────────────────────────────────────────────

    it("keeps a single selected leaf as-is", () => {
        expect(names(["a1x"])).toEqual(["a1x"]);
    });

    it("keeps a partial sibling selection as-is (2 of 3)", () => {
        const wide = [ ...tree, course("a3", "a") ];
        expect(names(["a1", "a2"], wide)).toEqual(["a1", "a2"]);
    });

    it("keeps leaves from unrelated branches separate", () => {
        // b1 is an only child, so it still rolls up to b — the point here is
        // that the two branches are reported independently.
        expect(names(["a1x", "b1"])).toEqual(["a1x", "b"]);
    });

    it("does not roll a single child up to a multi-child parent", () => {
        expect(names(["a1x"])).toEqual(["a1x"]);
    });

    // ─── Single-level roll-up ───────────────────────────────────────────────

    it("collapses all children of a parent into the parent", () => {
        expect(names(["a1x", "a1y"])).toEqual(["a1"]);
    });

    it("collapses an only-child into its parent", () => {
        expect(names(["b1"])).toEqual(["b"]);
    });

    it("collapses when the parent itself is also selected", () => {
        expect(names(["a1", "a1x", "a1y"])).toEqual(["a1"]);
    });

    it("emits a selected parent alone, without its unselected children", () => {
        expect(names(["a1"])).toEqual(["a1"]);
    });

    // ─── Multi-level roll-up ────────────────────────────────────────────────

    it("cascades roll-up through two levels", () => {
        // a1x + a1y ⇒ a1; a1 + a2 ⇒ a.
        expect(names(["a1x", "a1y", "a2"])).toEqual(["a"]);
    });

    it("stops the cascade one level below an incomplete parent", () => {
        // a1 is complete, a2 is missing ⇒ a stays open, a1 is emitted.
        expect(names(["a1x", "a1y"])).toEqual(["a1"]);
    });

    it("collapses a deep chain to its root", () => {
        const chain = [
            course("r"),
            course("r1", "r"),
            course("r11", "r1"),
            course("r111", "r11"),
        ];
        expect(names(["r111"], chain)).toEqual(["r"]);
    });

    it("collapses every course to the set of roots", () => {
        expect(names(tree.map((c) => c.id))).toEqual(["a", "b", "c"]);
    });

    it("collapses all leaves to the set of roots", () => {
        expect(names(["a1x", "a1y", "a2", "b1", "c"])).toEqual([
            "a",
            "b",
            "c",
        ]);
    });

    // ─── Mixed branches ─────────────────────────────────────────────────────

    it("mixes a collapsed branch with an uncollapsed sibling branch", () => {
        // a1 complete ⇒ a1; b1 ⇒ b (only child).
        expect(names(["a1x", "a1y", "b1"])).toEqual(["a1", "b"]);
    });

    it("emits a root leaf next to a rolled-up branch", () => {
        expect(names(["a1x", "a1y", "a2", "c"])).toEqual(["a", "c"]);
    });

    // ─── Ordering and identity ──────────────────────────────────────────────

    it("returns courses in the source list order, not selection order", () => {
        expect(names(["c", "b1", "a1x"])).toEqual(["a1x", "b", "c"]);
    });

    it("returns the original course objects", () => {
        const [ result ] = collapseCourseSelection(["c"], tree);
        expect(result).toBe(tree.find((c) => c.id === "c"));
    });

    it("does not mutate its inputs", () => {
        const selection = ["a1x", "a1y"];
        const snapshot = structuredClone(tree);
        collapseCourseSelection(selection, tree);
        expect(selection).toEqual(["a1x", "a1y"]);
        expect(tree).toEqual(snapshot);
    });

    // ─── Malformed data ─────────────────────────────────────────────────────

    it("treats a course with a dangling parentId as a root", () => {
        const orphaned = [ course("o", "missing-parent") ];
        expect(names(["o"], orphaned)).toEqual(["o"]);
    });

    it("treats an explicit null parentId as a root", () => {
        expect(names(["c"])).toEqual(["c"]);
    });

    it("treats an undefined parentId as a root", () => {
        const undef: Array<Course> = [
            { id: "u", name: "u", color: null },
        ];
        expect(names(["u"], undef)).toEqual(["u"]);
    });

    it("does not hang on a parent cycle", () => {
        const cyclic = [ course("x", "y"), course("y", "x") ];
        // Neither node is reachable as a root, so nothing renders — but the
        // walk must terminate rather than recurse forever.
        expect(names(["x", "y"], cyclic)).toEqual([]);
    });

    it("does not hang on a self-parenting course", () => {
        const selfish = [ course("s", "s") ];
        expect(names(["s"], selfish)).toEqual([]);
    });

    it("handles a wide tree without collapsing on a near-complete selection", () => {
        const wide: Array<Course> = [
            course("w"),
            ...Array.from({ length: 20 }, (_, i) => course(`w${i}`, "w")),
        ];
        const allButOne = Array.from({ length: 19 }, (_, i) => `w${i}`);
        expect(names(allButOne, wide)).toEqual(allButOne);
        expect(names([ ...allButOne, "w19" ], wide)).toEqual(["w"]);
    });
});
