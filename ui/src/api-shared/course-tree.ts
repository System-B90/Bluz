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

/**
 * Every course on the tree path through `courseIds`: the courses themselves,
 * all their ancestors and all their descendants. An event tagged for a shuffle
 * concerns the shuffles above it (whose students include it) and below it
 * (which are part of it). Ids of unknown courses are ignored; cycles are safe.
 */
export function relatedCourses(
    courseIds: Iterable<string>,
    courses: Array<Pick<Course, "id" | "parentId">>,
): Set<string> {
    const parentById = new Map(courses.map((c) => [c.id, c.parentId ?? null]));
    const childrenById = new Map<string, Array<string>>();
    for (const { id, parentId } of courses) {
        if (!parentId) continue;
        childrenById.set(parentId, [...(childrenById.get(parentId) ?? []), id]);
    }

    const related = new Set<string>();
    const walk = (start: string, next: (id: string) => Array<string>) => {
        const stack = [start];
        const seen = new Set<string>();
        while (stack.length > 0) {
            const id = stack.pop()!;
            if (seen.has(id)) continue;
            seen.add(id);
            related.add(id);
            stack.push(...next(id));
        }
    };
    for (const id of new Set(courseIds)) {
        if (!parentById.has(id)) continue;
        walk(id, (cur) => {
            const parent = parentById.get(cur);
            return parent && parentById.has(parent) ? [parent] : [];
        });
        walk(id, (cur) => childrenById.get(cur) ?? []);
    }
    return related;
}
