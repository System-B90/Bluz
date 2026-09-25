import { describe, expect, it } from "vitest";

import { isShuffleCourse } from "@/api-shared/course-tree";
import { Course } from "@/api-shared/types/course";
import { buildCourseOptions } from "@/components/base/course-options";

/**
 * The course picker's row list: nested depth-first, filterable by subtree,
 * by shuffle-ness, and by search text (keeping ancestors as context).
 */

function course(id: string, parentId?: string, shuffle = false): Course {
    return {
        id,
        name: id,
        color: null,
        parentId: parentId ?? null,
        description: shuffle ? 'נגזר מסילבוס "סילבוס"' : undefined,
    };
}

/**
 *   a ── a1 ── a1x
 *     │     └─ S (shuffle) ── a1s
 *     └─ a2
 *   b ── b1
 */
const tree: Array<Course> = [
    course("b"),
    course("a2", "a"),
    course("a"),
    course("a1", "a"),
    course("a1x", "a1"),
    course("S", "a1", true),
    course("a1s", "S"),
    course("b1", "b"),
];

const rows = (options: ReturnType<typeof buildCourseOptions>) =>
    options.map((o) => `${o.course.id}@${o.depth}${o.contextOnly ? "*" : ""}`);

describe("isShuffleCourse", () => {
    it("recognises the cut pipeline's description marker", () => {
        expect(isShuffleCourse(course("S", undefined, true))).toBe(true);
        expect(isShuffleCourse(course("a"))).toBe(false);
        expect(isShuffleCourse({ description: "ידני" })).toBe(false);
    });
});

describe("buildCourseOptions", () => {
    it("lists the whole tree depth-first, sorted, with depths", () => {
        expect(rows(buildCourseOptions(tree))).toEqual([
            "a@0", "a1@1", "a1x@2", "S@2", "a1s@3", "a2@1", "b@0", "b1@1",
        ]);
    });

    it("limits to descendants of rootId, excluding the root", () => {
        expect(rows(buildCourseOptions(tree, { rootId: "a1" }))).toEqual([
            "a1x@0", "S@0", "a1s@1",
        ]);
    });

    it("hides shuffles and lifts their children to the nearest visible ancestor", () => {
        expect(rows(buildCourseOptions(tree, { showShuffles: false }))).toEqual([
            "a@0", "a1@1", "a1s@2", "a1x@2", "a2@1", "b@0", "b1@1",
        ]);
    });

    it("keeps a shuffle rootId as the subtree anchor even when shuffles are hidden", () => {
        expect(
            rows(buildCourseOptions(tree, { rootId: "S", showShuffles: false })),
        ).toEqual(["a1s@0"]);
    });

    it("keeps search matches with their ancestors as context", () => {
        expect(rows(buildCourseOptions(tree, { searchQuery: " A1X " }))).toEqual([
            "a@0*", "a1@1*", "a1x@2",
        ]);
    });

    it("returns nothing when no course matches", () => {
        expect(buildCourseOptions(tree, { searchQuery: "zzz" })).toEqual([]);
    });

    it("treats unknown parents as top level and survives cycles", () => {
        const cyclic = [course("x", "y"), course("y", "x"), course("o", "ghost")];
        expect(rows(buildCourseOptions(cyclic)).sort()).toEqual(["o@0"]);
    });
});
