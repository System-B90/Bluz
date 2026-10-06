import { Course, CourseId } from "@/api-shared/types/course";
import { buildCourseOptions, CourseOption } from "@/components/base/course-options";

/**
 * Whether making `targetId` the parent of `movingId` would put the course
 * inside itself: the target is the course or one of its descendants.
 * Shared by the drag drop and the move menu (#885). Cycles in the data are
 * safe.
 */
export function wouldNestInsideItself(
    courses: ReadonlyArray<Course>,
    movingId: CourseId,
    targetId: CourseId,
): boolean
{
    const byId = new Map(courses.map((c) => [ c.id, c ]));
    const seen = new Set<CourseId>();
    let current = byId.get(targetId);
    while (current && !seen.has(current.id))
    {
        if (current.id === movingId) return true;
        seen.add(current.id);
        current = current.parentId ? byId.get(current.parentId) : undefined;
    }
    return false;
}

/**
 * Where `course` can move to, as course-tree rows: every course except the
 * course itself, its descendants (which would make a cycle) and its current
 * parent (a no-op).
 */
export function moveTargets(
    courses: ReadonlyArray<Course>,
    course: Course,
): Array<CourseOption>
{
    return buildCourseOptions(courses).filter(({ course: target }) =>
        target.id !== course.parentId && !wouldNestInsideItself(courses, course.id, target.id));
}

export function moveCourseLabel(course: Pick<Course, "name">): string
{
    return `העברת ${course.name}…`;
}

/**
 * Focuses a course's card once the tree has re-rendered after a move: the
 * card that held focus may have just unmounted under a collapsed parent.
 * CourseItem marks each card with `data-course-card`.
 */
export function focusCourseCard(courseId: CourseId): void
{
    if (typeof window === "undefined") return;
    window.requestAnimationFrame(() =>
    {
        document
            .querySelector<HTMLElement>(`[data-course-card="${CSS.escape(courseId)}"]`)
            ?.focus();
    });
}
