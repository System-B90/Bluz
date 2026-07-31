"use client";
import { useMemo } from "react";

import { Course } from "@/api-shared/types/course";
import { CourseUser } from "@/api-shared/types/hive";
import { useCourses } from "@/components/base/CoursesProvider";
import { useHiveUsers } from "@/components/base/HiveUsersProvider";

export const sortHe = (a: string, b: string) => a.localeCompare(b, "he");

export type InstructorCourseGroup = {
    course: Course;
    instructors: Array<CourseUser>;
};

export type GroupedInstructors = {
    /** Course groups in parent-before-child order, empty groups dropped. */
    courseGroups: Array<InstructorCourseGroup>;
    /** Instructors no course claims (ללא מסלול). */
    unassigned: Array<CourseUser>;
};

export type GroupedInstructorsOptions = {
    searchQuery?: string;
    excludeTeachers?: boolean;
};

/**
 * Groups instructors under the course (מסלול) tree they belong to, walking
 * parents before children so nested programs read in hierarchy order. Shared by
 * the instructor select boxes and the schedule instructor rail so both present
 * the same grouping.
 *
 * @param options Free-text filter and whether teachers are excluded.
 * @returns Course-grouped instructors plus the unassigned remainder.
 */
export function useGroupedInstructors({
    searchQuery = "",
    excludeTeachers = false,
}: GroupedInstructorsOptions = {}): GroupedInstructors {
    const { courses } = useCourses();
    const { instructors, getInstructor } = useHiveUsers();

    return useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        const coursesByParent: Record<string, Array<Course>> = {};
        const rootCourses: Array<Course> = [];
        const assignedIds = new Set<number>();

        courses.forEach((course) => {
            course.instructorIds?.forEach((id) => assignedIds.add(id));
            if (course.parentId) {
                (coursesByParent[course.parentId] ??= []).push(course);
            } else {
                rootCourses.push(course);
            }
        });

        const filterInst = (inst: CourseUser) =>
            inst.display_name.toLowerCase().includes(query) &&
            (!excludeTeachers || !inst.teacher);

        const courseGroups: Array<InstructorCourseGroup> = [];

        const traverse = (parentId: null | string) => {
            const siblings =
                parentId === null
                    ? rootCourses
                    : (coursesByParent[parentId] ?? []);

            for (const course of [...siblings].sort((a, b) =>
                sortHe(a.name, b.name),
            )) {
                const resolved = (course.instructorIds ?? [])
                    .map(getInstructor)
                    .filter(
                        (inst): inst is CourseUser =>
                            inst !== undefined && filterInst(inst),
                    )
                    .sort((a, b) => sortHe(a.display_name, b.display_name));

                if (resolved.length > 0) {
                    courseGroups.push({ course, instructors: resolved });
                }
                traverse(course.id);
            }
        };

        traverse(null);

        const unassigned = instructors
            .filter((inst) => !assignedIds.has(inst.id) && filterInst(inst))
            .sort((a, b) => sortHe(a.display_name, b.display_name));

        return { courseGroups, unassigned };
    }, [courses, instructors, getInstructor, excludeTeachers, searchQuery]);
}
