import {
    ListSubheader,
    MenuItem,
    Select,
    SelectProps,
} from "@mui/material";
import React, { useMemo } from "react";

import { Course } from "@/api-shared/types/course";
import { CourseUser } from "@/api-shared/types/hive";
import { useCourses } from "@/components/base/CoursesProvider";
import { useHiveUsers } from "@/components/base/HiveUsersProvider";

export function InstructorSelect<T = unknown>({ children, ...props }: SelectProps<T>) {
    const { courses } = useCourses();
    const { instructors, getInstructor } = useHiveUsers();

    const groupedItems = useMemo(() => {
        // 1. Build course hierarchy adjacency list
        const coursesByParent: Record<string, Course[]> = {};
        const rootCourses: Course[] = [];

        for (const course of courses) {
            if (course.parentId) {
                if (!coursesByParent[course.parentId]) {
                    coursesByParent[course.parentId] = [];
                }
                coursesByParent[course.parentId].push(course);
            } else {
                rootCourses.push(course);
            }
        }

        // 2. Helper to traverse courses hierarchically
        const traverse = (
            parentId: string | null,
        ): Array<{ course: Course; instructors: CourseUser[] }> => {
            const siblings =
                parentId === null ? rootCourses : coursesByParent[parentId] || [];
            // Sort sibling courses alphabetically
            const sortedSiblings = [...siblings].sort((a, b) =>
                a.name.localeCompare(b.name, "he"),
            );

            const list: Array<{ course: Course; instructors: CourseUser[] }> = [];
            for (const course of sortedSiblings) {
                const assignedIds = course.instructorIds || [];
                const resolved: CourseUser[] = [];
                for (const id of assignedIds) {
                    const inst = getInstructor(id);
                    if (inst) {
                        resolved.push(inst);
                    }
                }
                // Sort instructors within this group alphabetically
                resolved.sort((a, b) => a.display_name.localeCompare(b.display_name, "he"));

                if (resolved.length > 0) {
                    list.push({ course, instructors: resolved });
                }

                // Traverse child courses (siblings relative to each other)
                const childGroups = traverse(course.id);
                list.push(...childGroups);
            }
            return list;
        };

        const courseGroups = traverse(null);

        // 3. Collect instructors not assigned to any course
        const assignedInstructorIds = new Set<number>();
        for (const course of courses) {
            if (course.instructorIds) {
                for (const id of course.instructorIds) {
                    assignedInstructorIds.add(id);
                }
            }
        }

        const unassigned = instructors.filter(
            (inst) => !assignedInstructorIds.has(inst.id),
        );
        unassigned.sort((a, b) => a.display_name.localeCompare(b.display_name, "he"));

        return {
            courseGroups,
            unassigned,
        };
    }, [courses, instructors, getInstructor]);

    // 4. Flatten all components (children, groups, unassigned) to avoid using React.Fragment
    // which can break MUI Select arrow/keyboard navigation.
    const items = useMemo(() => {
        const result: React.ReactNode[] = [];
        if (children) {
            result.push(children);
        }

        groupedItems.courseGroups.forEach(({ course, instructors }) => {
            result.push(
                <ListSubheader
                    disableSticky
                    key={`subheader-${course.id}`}
                    sx={{
                        fontWeight: "bold",
                        lineHeight: "36px",
                        color: "text.secondary",
                        bgcolor: "background.paper",
                    }}
                >
                    {course.name}
                </ListSubheader>,
            );
            instructors.forEach((inst) => {
                result.push(
                    <MenuItem key={`course-${course.id}-${inst.id}`} value={inst.id}>
                        {inst.display_name}
                    </MenuItem>,
                );
            });
        });

        if (groupedItems.unassigned.length > 0) {
            result.push(
                <ListSubheader
                    disableSticky
                    key="subheader-unassigned"
                    sx={{
                        fontWeight: "bold",
                        lineHeight: "36px",
                        color: "text.secondary",
                        bgcolor: "background.paper",
                    }}
                >
                    ללא מסלול
                </ListSubheader>,
            );
            groupedItems.unassigned.forEach((inst) => {
                result.push(
                    <MenuItem key={`unassigned-${inst.id}`} value={inst.id}>
                        {inst.display_name}
                    </MenuItem>,
                );
            });
        }

        return result;
    }, [children, groupedItems]);

    return <Select<T> {...props}>{items}</Select>;
}
