import { Course } from "@/api-shared/types/course";
import { isOrchestratedBy } from "@/components/gantt/curriculum-view/tabs/syllabuses-tab/orchestrated-first";

type Syllabuses = Record<string, { courseIds?: Array<string>; modules: Array<string> } | undefined>;
type State = Parameters<typeof isOrchestratedBy>[2] & { syllabuses: Syllabuses };

/** Courses the user instructs, plus every ancestor: being in Apollo team A means being in Apollo and the root too. */
function userCourseIds(courses: Array<Course>, userId: number): Set<string>
{
    const byId = new Map(courses.map((course) => [ course.id, course ]));
    const ids = new Set<string>();
    for (const course of courses)
    {
        if (!course.instructorIds?.includes(userId)) continue;
        for (let current: Course | undefined = course; current && !ids.has(current.id); current = current.parentId ? byId.get(current.parentId) : undefined)
            ids.add(current.id);
    }
    return ids;
}

/**
 * The syllabuses a viewer sees open before touching anything: the ones they
 * orchestrate; failing that, the ones that exist for a course they are in
 * (a syllabus with no course is for everyone); failing that, none.
 */
export function defaultExpandedSyllabusIds(
    syllabusIds: Array<string>,
    state: State,
    courses: Array<Course>,
    userId: null | number | undefined,
): Array<string>
{
    if (userId == null) return [];
    const orchestrated = syllabusIds.filter((id) => isOrchestratedBy(id, userId, state));
    if (orchestrated.length > 0) return orchestrated;
    const mine = userCourseIds(courses, userId);
    return syllabusIds.filter((id) =>
    {
        const courseIds = state.syllabuses[ id ]?.courseIds ?? [];
        return courseIds.length === 0 || courseIds.some((courseId) => mine.has(courseId));
    });
}
