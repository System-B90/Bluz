import { Course } from "@/api-shared/types/course";
import { Class } from "@/api-shared/types/hive";

/**
 * The Hive student group a Bluz course (a shuffle) syncs against: its
 * explicitly linked group when set (#774), else the group with its exact name.
 */
export function findCourseHiveGroup<T extends Pick<Class, "id" | "name">>(
    course: Pick<Course, "hiveClassId" | "name">,
    groups: Array<T>,
): T | undefined {
    if (course.hiveClassId) {
        const linked = groups.find(
            (group) => Number(group.id) === course.hiveClassId,
        );
        if (linked) return linked;
    }
    return groups.find((group) => group.name === course.name);
}
