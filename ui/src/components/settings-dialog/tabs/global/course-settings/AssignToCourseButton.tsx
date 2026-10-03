import CheckIcon from "@mui/icons-material/Check";
import PlaylistAddIcon from "@mui/icons-material/PlaylistAdd";
import IconButton from "@mui/material/IconButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import { MouseEvent, useCallback, useMemo, useState } from "react";

import { Course } from "@/api-shared/types/course";
import { CourseUser } from "@/api-shared/types/hive";
import { buildCourseOptions } from "@/components/base/course-options";
import { useCourses } from "@/components/base/CoursesProvider";

/** Instructor ids after toggling one instructor on a course (#848). */
export function toggleInstructor(ids: ReadonlyArray<number> | undefined, instructorId: number): Array<number> {
    const current = ids ?? [];
    return current.includes(instructorId)
        ? current.filter((id) => id !== instructorId)
        : [ ...current, instructorId ];
}

export function assignToCourseLabel(instructor: Pick<CourseUser, "display_name">): string {
    return `שיוך ${instructor.display_name} למסלול…`;
}

/**
 * Keyboard/click alternative to dragging an instructor into a course (#848):
 * a menu of the course tree; picking a course toggles the instructor on it.
 */
export function AssignToCourseButton({ instructor }: { instructor: CourseUser }) {
    const { courses, updateCoursePartial } = useCourses();
    const [ anchorEl, setAnchorEl ] = useState<HTMLElement | null>(null);
    const options = useMemo(() => buildCourseOptions(courses), [ courses ]);

    const open = useCallback((event: MouseEvent<HTMLElement>) => {
        // The card itself is a drag handle; don't let the click start a drag.
        event.stopPropagation();
        setAnchorEl(event.currentTarget);
    }, []);

    const toggle = useCallback((course: Course) => {
        setAnchorEl(null);
        void updateCoursePartial(course.id, {
            instructorIds: toggleInstructor(course.instructorIds, instructor.id),
        });
    }, [ instructor.id, updateCoursePartial ]);

    return (
        <>
            <IconButton
                aria-haspopup="menu"
                aria-label={ assignToCourseLabel(instructor) }
                onClick={ open }
                onKeyDown={ (event) => event.stopPropagation() }
                onPointerDown={ (event) => event.stopPropagation() }
                size="small"
                sx={ { marginInlineStart: "auto" } }
            >
                <PlaylistAddIcon fontSize="small" />
            </IconButton>
            <Menu anchorEl={ anchorEl } onClose={ () => setAnchorEl(null) } open={ Boolean(anchorEl) }>
                <MenuItem disabled sx={ { fontSize: "0.75rem", fontWeight: 700 } }>
                    שיוך / הסרה ממסלול
                </MenuItem>
                { options.map(({ course, depth }) => {
                    const assigned = (course.instructorIds ?? []).includes(instructor.id);
                    return (
                        <MenuItem
                            aria-checked={ assigned }
                            key={ course.id }
                            onClick={ () => toggle(course) }
                            role="menuitemcheckbox"
                            sx={ { paddingInlineStart: 2 + depth * 2, fontSize: "0.8rem" } }
                        >
                            <ListItemIcon>{ assigned ? <CheckIcon fontSize="small" /> : null }</ListItemIcon>
                            <ListItemText>{ course.name }</ListItemText>
                        </MenuItem>
                    );
                }) }
                { options.length === 0 && (
                    <MenuItem disabled sx={ { fontSize: "0.8rem" } }>אין מסלולים</MenuItem>
                ) }
            </Menu>
        </>
    );
}
