import ListSubheader from "@mui/material/ListSubheader";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import SelectProps from "@mui/material/SelectProps";
import TextField from "@mui/material/TextField";
import React, { useMemo, useState } from "react";

import { Course } from "@/api-shared/types/course";
import { CourseUser } from "@/api-shared/types/hive";
import { useCourses } from "@/components/base/CoursesProvider";
import { useHiveUsers } from "@/components/base/HiveUsersProvider";
import { useOutsiders } from "@/components/base/OutsidersProvider";

type CustomInstructorSelectProps<T> = {
    showOutsiders?: boolean;
    favoriteOutsiders?: Array<string>;
    excludeTeachers?: boolean;
} & SelectProps<T>;

const sortHe = (a: string, b: string) => a.localeCompare(b, "he");

const styles = {
    subheaderWarning: {
        fontWeight: "bold",
        lineHeight: "36px",
        color: "warning.main",
        bgcolor: "background.paper",
    },
    subheaderDefault: {
        fontWeight: "bold",
        lineHeight: "36px",
        color: "text.secondary",
        bgcolor: "background.paper",
    },
};

function useOutsiderData(
    outsiders: Array<any>,
    searchQuery: string,
    favoriteIds: Array<string>,
) {
    return useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        const filtered = query
            ? outsiders.filter((o) => o.name.toLowerCase().includes(query))
            : outsiders;

        const favorites: Array<any> = [];
        const others: Array<any> = [];

        filtered.forEach((o) => {
            if (favoriteIds.includes(o.id)) favorites.push(o);
            else others.push(o);
        });

        favorites.sort((a, b) => sortHe(a.name, b.name));
        others.sort((a, b) => sortHe(a.name, b.name));

        return { favorites, others };
    }, [outsiders, searchQuery, favoriteIds]);
}

function useInstructorData(
    courses: Array<Course>,
    instructors: Array<CourseUser>,
    getInstructor: (id: number) => CourseUser | undefined,
    excludeTeachers: boolean,
    searchQuery: string,
) {
    return useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        const coursesByParent: Record<string, Array<Course>> = {};
        const rootCourses: Array<Course> = [];
        const assignedIds = new Set<number>();

        courses.forEach((course) => {
            if (course.instructorIds) {
                course.instructorIds.forEach((id) => assignedIds.add(id));
            }
            if (course.parentId) {
                (coursesByParent[course.parentId] ??= []).push(course);
            } else {
                rootCourses.push(course);
            }
        });

        const filterInst = (inst: CourseUser) => {
            const matchesSearch = inst.display_name
                .toLowerCase()
                .includes(query);
            const matchesRole = !excludeTeachers || !inst.teacher;
            return matchesSearch && matchesRole;
        };

        const courseGroups: Array<{
            course: Course;
            instructors: Array<CourseUser>;
        }> = [];

        const traverse = (parentId: null | string) => {
            const siblings =
                parentId === null
                    ? rootCourses
                    : coursesByParent[parentId] || [];
            const sortedSiblings = [...siblings].sort((a, b) =>
                sortHe(a.name, b.name),
            );

            for (const course of sortedSiblings) {
                const resolved = (course.instructorIds || [])
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

export function InstructorSelect<T = unknown>({
    children,
    showOutsiders = false,
    favoriteOutsiders = [],
    excludeTeachers = false,
    ...props
}: CustomInstructorSelectProps<T>) {
    const { courses } = useCourses();
    const { instructors, getInstructor } = useHiveUsers();
    const { outsiders } = useOutsiders();

    const [searchQuery, setSearchQuery] = useState("");

    const { courseGroups, unassigned } = useInstructorData(
        courses,
        instructors,
        getInstructor,
        excludeTeachers,
        searchQuery,
    );

    const { favorites, others } = useOutsiderData(
        outsiders,
        searchQuery,
        favoriteOutsiders,
    );

    const handleSearchEvent = (e: React.KeyboardEvent | React.MouseEvent) => {
        if (
            e.type === "keydown" &&
            (e as React.KeyboardEvent).key === "Escape"
        ) {
            return;
        }
        e.stopPropagation();
    };

    return (
        <Select<T>
            {...props}
            MenuProps={{
                autoFocus: false,
                ...props.MenuProps,
                PaperProps: {
                    ...props.MenuProps?.PaperProps,
                    sx: {
                        maxHeight: 400,
                        ...props.MenuProps?.PaperProps?.sx,
                    },
                },
            }}
        >
            <ListSubheader
                component="div"
                onClick={handleSearchEvent}
                onKeyDown={handleSearchEvent}
                onKeyUp={handleSearchEvent}
                sx={{
                    p: 1.5,
                    position: "sticky",
                    top: 0,
                    bgcolor: "background.paper",
                    zIndex: 2,
                    borderBottom: "1px solid",
                    borderColor: "divider",
                    lineHeight: "normal",
                }}
            >
                <TextField
                    autoFocus
                    fullWidth
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={
                        excludeTeachers ? "חיפוש מדריך..." : "חיפוש..."
                    }
                    size="small"
                    value={searchQuery}
                />
            </ListSubheader>

            {children}

            {showOutsiders && favorites.length > 0
                ? [
                    <ListSubheader
                        disableSticky
                        key="group-favs"
                        sx={styles.subheaderWarning}
                    >
                          אנשי חוץ מועדפים
                    </ListSubheader>,
                    ...favorites.map((o) => (
                        <MenuItem key={`outsider-${o.id}`} value={o.id}>
                            {o.name}
                        </MenuItem>
                    )),
                ]
                : null}

            {courseGroups.flatMap(({ course, instructors }) => [
                <ListSubheader
                    disableSticky
                    key={`group-${course.id}`}
                    sx={styles.subheaderDefault}
                >
                    {course.name}
                </ListSubheader>,
                ...instructors.map((inst) => (
                    <MenuItem
                        key={`course-${course.id}-${inst.id}`}
                        value={inst.id}
                    >
                        {inst.display_name}
                    </MenuItem>
                )),
            ])}

            {unassigned.length > 0
                ? [
                    <ListSubheader
                        disableSticky
                        key="group-unassigned"
                        sx={styles.subheaderDefault}
                    >
                          ללא מסלול
                    </ListSubheader>,
                    ...unassigned.map((inst) => (
                        <MenuItem
                            key={`unassigned-${inst.id}`}
                            value={inst.id}
                        >
                            {inst.display_name}
                        </MenuItem>
                    )),
                ]
                : null}

            {showOutsiders && others.length > 0
                ? [
                    <ListSubheader
                        disableSticky
                        key="group-others"
                        sx={styles.subheaderDefault}
                    >
                          אנשי חוץ נוספים
                    </ListSubheader>,
                    ...others.map((o) => (
                        <MenuItem key={`outsider-${o.id}`} value={o.id}>
                            {o.name}
                        </MenuItem>
                    )),
                ]
                : null}
        </Select>
    );
}
