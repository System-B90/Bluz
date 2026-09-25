import { isShuffleCourse } from "@/api-shared/course-tree";
import { Course, CourseId } from "@/api-shared/types/course";
import { sortHe } from "@/components/base/use-grouped-instructors";

export type CourseOption = {
    course: Course;
    /** Nesting level below the listed roots, 0 for top-level rows. */
    depth: number;
    /** Shown only as context for a matching descendant, not a match itself. */
    contextOnly: boolean;
};

export type CourseOptionsFilter = {
    /** List only courses nested (at any depth) under this course. */
    rootId?: CourseId | null;
    showShuffles?: boolean;
    searchQuery?: string;
};

/**
 * Flattens the course tree into select rows in depth-first order, siblings
 * sorted by Hebrew name.
 *
 * Hidden shuffle-courses lift their visible descendants up to the nearest
 * visible ancestor, so hiding a shuffle never hides a regular course. A search
 * keeps matching courses plus their ancestors (flagged `contextOnly`), so a
 * match always shows where it sits in the tree. Cycles are safe.
 */
export function buildCourseOptions(
    courses: ReadonlyArray<Course>,
    { rootId = null, showShuffles = true, searchQuery = "" }: CourseOptionsFilter = {},
): Array<CourseOption> {
    const byId = new Map(courses.map((c) => [c.id, c]));
    const isVisible = (c: Course) => showShuffles || !isShuffleCourse(c);

    // Nearest visible ancestor (or null = top level), skipping hidden ones.
    const visibleParentOf = (course: Course): CourseId | null => {
        const seen = new Set<CourseId>([course.id]);
        let parent = course.parentId ? byId.get(course.parentId) : undefined;
        while (parent && !seen.has(parent.id)) {
            if (isVisible(parent) || parent.id === rootId) return parent.id;
            seen.add(parent.id);
            parent = parent.parentId ? byId.get(parent.parentId) : undefined;
        }
        return null;
    };

    const childrenOf = new Map<CourseId | null, Array<Course>>();
    for (const course of courses) {
        if (!isVisible(course) && course.id !== rootId) continue;
        const parentId = visibleParentOf(course);
        const siblings = childrenOf.get(parentId);
        if (siblings) siblings.push(course);
        else childrenOf.set(parentId, [course]);
    }
    for (const siblings of childrenOf.values()) {
        siblings.sort((a, b) => sortHe(a.name, b.name));
    }

    const query = searchQuery.trim().toLowerCase();
    const matches = (c: Course) => c.name.toLowerCase().includes(query);

    const result: Array<CourseOption> = [];
    const visited = new Set<CourseId>();

    // Returns whether the subtree holds a match, emitting its rows if so.
    const walk = (course: Course, depth: number): boolean => {
        if (visited.has(course.id)) return false;
        visited.add(course.id);
        const index = result.length;
        const self = !query || matches(course);
        result.push({ course, depth, contextOnly: !self });
        let anyChild = false;
        for (const child of childrenOf.get(course.id) ?? []) {
            if (walk(child, depth + 1)) anyChild = true;
        }
        if (!self && !anyChild) result.splice(index);
        return self || anyChild;
    };

    for (const top of childrenOf.get(rootId) ?? []) walk(top, 0);
    return result;
}
