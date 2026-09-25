"use client";
import GroupsIcon from "@mui/icons-material/Groups";
import Checkbox from "@mui/material/Checkbox";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import MenuItem from "@mui/material/MenuItem";
import Typography from "@mui/material/Typography";
import { useMemo, useState } from "react";

import { CourseId } from "@/api-shared/types/course";
import { buildCourseOptions } from "@/components/base/course-options";
import { useCourses } from "@/components/base/CoursesProvider";
import { SelectSearchHeader } from "@/components/base/SelectSearchHeader";
import { Submenu } from "@/components/schedule/event-context-menu/Submenu";

const INDENT_PER_DEPTH = 2;

export type CourseSubmenuProps = {
    /** Whether all, some or none of the targeted events carry the course. */
    stateOf: (courseId: CourseId) => "all" | "none" | "some";
    onToggle: (courseId: CourseId) => void;
};

/**
 * The context menu's course assignment: the course tree nested like
 * `CourseSelect`, with its search box and arrow-key hand-off, but tri-state
 * checkboxes since one click can target several events. Stays open on click.
 */
export function CourseSubmenu({ stateOf, onToggle }: CourseSubmenuProps) {
    const { courses } = useCourses();
    const [searchQuery, setSearchQuery] = useState("");

    const options = useMemo(
        () => buildCourseOptions(courses, { searchQuery }),
        [courses, searchQuery],
    );

    return (
        <Submenu icon={<GroupsIcon fontSize="small" />} label="שיוך מסלולים">
            <SelectSearchHeader
                onChange={setSearchQuery}
                placeholder="חיפוש מסלול..."
                value={searchQuery}
            />
            {options.length === 0 ? (
                <Typography
                    sx={{ px: 2, py: 1, color: "text.secondary" }}
                    variant="body2"
                >
                    אין מסלולים
                </Typography>
            ) : (
                options.map(({ course, depth, contextOnly }) => {
                    const state = stateOf(course.id);
                    return (
                        <MenuItem
                            data-depth={depth}
                            key={course.id}
                            onClick={() => onToggle(course.id)}
                            sx={{
                                paddingInlineStart: 2 + depth * INDENT_PER_DEPTH,
                                color: contextOnly ? "text.secondary" : undefined,
                            }}
                        >
                            <ListItemIcon>
                                <Checkbox
                                    checked={state === "all"}
                                    disableRipple
                                    indeterminate={state === "some"}
                                    size="small"
                                    sx={{ p: 0 }}
                                />
                            </ListItemIcon>
                            <ListItemText>{course.name}</ListItemText>
                        </MenuItem>
                    );
                })
            )}
        </Submenu>
    );
}
