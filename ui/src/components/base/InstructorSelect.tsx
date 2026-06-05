import {
    ListSubheader,
    MenuItem,
    Select,
    SelectProps,
    Box,
    TextField,
} from "@mui/material";
import React, { useMemo, useState } from "react";

import { Course } from "@/api-shared/types/course";
import { CourseUser } from "@/api-shared/types/hive";
import { useCourses } from "@/components/base/CoursesProvider";
import { useHiveUsers } from "@/components/base/HiveUsersProvider";
import { useOutsiders } from "@/components/base/OutsidersProvider";

type CustomInstructorSelectProps<T> = {
    showOutsiders?: boolean;
    favoriteOutsiders?: Array<string>;
} & SelectProps<T>;

export function InstructorSelect<T = unknown>({
    children,
    showOutsiders = false,
    favoriteOutsiders = [],
    ...props
}: CustomInstructorSelectProps<T>) {
    const { courses } = useCourses();
    const { instructors, getInstructor } = useHiveUsers();
    const { outsiders } = useOutsiders();

    const [searchQuery, setSearchQuery] = useState("");

    const groupedItems = useMemo(() => {
        // 1. Build course hierarchy adjacency list
        const coursesByParent: Record<string, Array<Course>> = {};
        const rootCourses: Array<Course> = [];

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
            parentId: null | string,
        ): Array<{ course: Course; instructors: Array<CourseUser> }> => {
            const siblings =
                parentId === null ? rootCourses : coursesByParent[parentId] || [];
            // Sort sibling courses alphabetically
            const sortedSiblings = [...siblings].sort((a, b) =>
                a.name.localeCompare(b.name, "he"),
            );

            const list: Array<{ course: Course; instructors: Array<CourseUser> }> = [];
            for (const course of sortedSiblings) {
                const assignedIds = course.instructorIds || [];
                const resolved: Array<CourseUser> = [];
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

    // Apply search filter to grouped items
    const filteredGroupedItems = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        if (!query) return groupedItems;

        const filteredCourseGroups = groupedItems.courseGroups.map((g) => ({
            ...g,
            instructors: g.instructors.filter((i) => i.display_name.toLowerCase().includes(query)),
        })).filter((g) => g.instructors.length > 0);

        const filteredUnassigned = groupedItems.unassigned.filter((i) => i.display_name.toLowerCase().includes(query));

        return {
            courseGroups: filteredCourseGroups,
            unassigned: filteredUnassigned,
        };
    }, [groupedItems, searchQuery]);

    // Apply search filter to outsiders
    const filteredOutsiders = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        if (!query) return outsiders;
        return outsiders.filter((o) => o.name.toLowerCase().includes(query));
    }, [outsiders, searchQuery]);

    // Split outsiders into favorite and other lists
    const { favoriteList, otherList } = useMemo(() => {
        const favList: Array<any> = [];
        const othList: Array<any> = [];

        filteredOutsiders.forEach((o) => {
            if (favoriteOutsiders.includes(o.id)) {
                favList.push(o);
            } else {
                othList.push(o);
            }
        });

        // Sort alphabetically
        favList.sort((a, b) => a.name.localeCompare(b.name, "he"));
        othList.sort((a, b) => a.name.localeCompare(b.name, "he"));

        return { favoriteList: favList, otherList: othList };
    }, [filteredOutsiders, favoriteOutsiders]);

    // 4. Flatten all components (children, groups, unassigned, outsiders)
    const items = useMemo(() => {
        const result: Array<React.ReactNode> = [];

        // Sticky search input at the top of the select
        result.push(
            <Box
                key="search-container"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
                sx={{
                    p: 1.5,
                    position: "sticky",
                    top: 0,
                    bgcolor: "background.paper",
                    zIndex: 2,
                    borderBottom: "1px solid",
                    borderColor: "divider",
                }}
            >
                <TextField
                    autoFocus
                    fullWidth
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key !== "Escape") {
                            e.stopPropagation();
                        }
                    }}
                    placeholder="חיפוש מרצה..."
                    size="small"
                    value={searchQuery}
                />
            </Box>
        );

        if (children) {
            result.push(children);
        }

        // Render favorite outsiders
        if (showOutsiders && favoriteList.length > 0) {
            result.push(
                <ListSubheader
                    disableSticky
                    key="subheader-favorites"
                    sx={{
                        fontWeight: "bold",
                        lineHeight: "36px",
                        color: "warning.main",
                        bgcolor: "background.paper",
                    }}
                >
                    אנשי חוץ מועדפים
                </ListSubheader>
            );
            favoriteList.forEach((outsider) => {
                result.push(
                    <MenuItem key={`outsider-${outsider.id}`} value={outsider.id}>
                        {outsider.name}
                    </MenuItem>
                );
            });
        }

        // Render course groups
        filteredGroupedItems.courseGroups.forEach(({ course, instructors }) => {
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

        // Render unassigned instructors
        if (filteredGroupedItems.unassigned.length > 0) {
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
            filteredGroupedItems.unassigned.forEach((inst) => {
                result.push(
                    <MenuItem key={`unassigned-${inst.id}`} value={inst.id}>
                        {inst.display_name}
                    </MenuItem>,
                );
            });
        }

        // Render other outsiders at the bottom
        if (showOutsiders && otherList.length > 0) {
            result.push(
                <ListSubheader
                    disableSticky
                    key="subheader-others"
                    sx={{
                        fontWeight: "bold",
                        lineHeight: "36px",
                        color: "text.secondary",
                        bgcolor: "background.paper",
                    }}
                >
                    אנשי חוץ נוספים
                </ListSubheader>
            );
            otherList.forEach((outsider) => {
                result.push(
                    <MenuItem key={`outsider-${outsider.id}`} value={outsider.id}>
                        {outsider.name}
                    </MenuItem>
                );
            });
        }

        return result;
    }, [children, showOutsiders, favoriteList, otherList, filteredGroupedItems, searchQuery]);

    return (
        <Select<T>
            {...props}
            MenuProps={{
                autoFocus: false,
                ...props.MenuProps,
                slotProps: {
                    ...props.MenuProps?.slotProps,
                    paper: {
                        ...props.MenuProps?.slotProps?.paper,
                        sx: {
                            maxHeight: 400,
                            ...props.MenuProps?.slotProps?.paper?.sx,
                        },
                    },
                },
            }}
        >
            {items}
        </Select>
    );
}
