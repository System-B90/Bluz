import { Course } from "@/api-shared/types/course";

/**
 * The deepest existing course that is (or contains) every course in
 * `courseIds` — the parent a shuffle's new course belongs under. A shuffle
 * whose syllabus sits only in Apollo lands under Apollo; one spread over Apollo
 * and Mivtzar lands under their shared parent. Null (top level) when no course
 * is given or the courses share no ancestor. Ids of unknown courses are ignored.
 */
export function lowestCommonCourse(
    courseIds: Iterable<string>,
    courses: Array<Pick<Course, "id" | "parentId">>,
): null | string {
    const parentById = new Map(courses.map((c) => [c.id, c.parentId ?? null]));
    const chainOf = (id: string): Array<string> => {
        const chain: Array<string> = [];
        for (
            let cur: null | string = id;
            cur && parentById.has(cur) && !chain.includes(cur);
            cur = parentById.get(cur) ?? null
        ) {
            chain.push(cur);
        }
        return chain;
    };

    const chains = [...new Set(courseIds)]
        .filter((id) => parentById.has(id))
        .map(chainOf);
    if (chains.length === 0) return null;
    const [first, ...rest] = chains;
    return (
        first.find((id) => rest.every((chain) => chain.includes(id))) ?? null
    );
}
