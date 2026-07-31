import { Course, CourseId } from "@/api-shared/types/course";

/**
 * Collapses a flat course selection up the course tree.
 *
 * A course counts as "covered" when it is selected itself, or when it has
 * children and every one of them is covered. Only the highest covered course of
 * each branch is returned, so selecting every child of a parent displays the
 * parent alone, and selecting every course displays the roots alone.
 *
 * @param selectedIds - The ids selected on the event.
 * @param allCourses - Every known course, used to rebuild the tree.
 * @returns The courses to display, in `allCourses` order.
 */
export function collapseCourseSelection(
    selectedIds: ReadonlyArray<CourseId>,
    allCourses: ReadonlyArray<Course>,
): Array<Course> {
    const byId = new Map(allCourses.map((course) => [course.id, course]));
    const childrenByParent = new Map<CourseId, Array<Course>>();
    const roots: Array<Course> = [];

    for (const course of allCourses) {
        const parent = course.parentId ? byId.get(course.parentId) : undefined;
        if (parent) {
            const siblings = childrenByParent.get(parent.id);
            if (siblings) siblings.push(course);
            else childrenByParent.set(parent.id, [course]);
        } else {
            roots.push(course);
        }
    }

    const selected = new Set(selectedIds);
    const coveredCache = new Map<CourseId, boolean>();

    const isCovered = (course: Course): boolean => {
        const cached = coveredCache.get(course.id);
        if (cached !== undefined) return cached;

        // Guard against cycles in malformed data.
        coveredCache.set(course.id, false);

        const children = childrenByParent.get(course.id);
        const covered =
            selected.has(course.id) ||
            (!!children?.length && children.every(isCovered));

        coveredCache.set(course.id, covered);
        return covered;
    };

    const result: Array<Course> = [];
    const collect = (course: Course) => {
        if (isCovered(course)) {
            result.push(course);
            return;
        }
        for (const child of childrenByParent.get(course.id) ?? []) {
            collect(child);
        }
    };

    for (const root of roots) collect(root);

    // Selections pointing at unknown courses are dropped by the tree walk;
    // nothing else to preserve since they cannot be rendered anyway.
    return result;
}
