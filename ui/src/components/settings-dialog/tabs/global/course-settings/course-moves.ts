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

/** What a screen reader hears, and the snackbar shows, after a move. */
export function movedCourseMessage(course: Pick<Course, "name">, target: null | Pick<Course, "name">): string
{
    return target
        ? `${course.name} הועבר אל ${target.name}`
        : `${course.name} הועבר לרמה העליונה`;
}
