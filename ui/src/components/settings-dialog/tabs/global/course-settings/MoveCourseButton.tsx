import DriveFileMoveIcon from "@mui/icons-material/DriveFileMove";
import VerticalAlignTopIcon from "@mui/icons-material/VerticalAlignTop";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Tooltip from "@mui/material/Tooltip";
import { useSnackbar } from "notistack";
import { MouseEvent, useCallback, useMemo, useState } from "react";

import { Course } from "@/api-shared/types/course";
import { useCourses } from "@/components/base/CoursesProvider";
import {
    moveCourseLabel,
    movedCourseMessage,
    moveTargets,
} from "@/components/settings-dialog/tabs/global/course-settings/course-moves";

export type MoveCourseButtonProps = {
    course: Course;
    /** Keeps the card's quick actions open while the menu is. */
    onOpenChange?: (open: boolean) => void;
};

/**
 * Keyboard/click alternative to dragging a course under another one, or onto
 * the root drop zone (#885). The menu lists only valid parents: never the
 * course itself or its descendants.
 */
export function MoveCourseButton({ course, onOpenChange }: MoveCourseButtonProps)
{
    const { courses, updateCoursePartial } = useCourses();
    const { enqueueSnackbar } = useSnackbar();
    const [ anchorEl, setAnchorEl ] = useState<HTMLElement | null>(null);
    const targets = useMemo(() => moveTargets(courses, course), [ courses, course ]);

    const setOpen = useCallback((anchor: HTMLElement | null) =>
    {
        setAnchorEl(anchor);
        onOpenChange?.(Boolean(anchor));
    }, [ onOpenChange ]);

    const open = useCallback((event: MouseEvent<HTMLElement>) =>
    {
        // The card row is a drag source; don't let the click start a drag.
        event.stopPropagation();
        setOpen(event.currentTarget);
    }, [ setOpen ]);

    const moveTo = useCallback((target: Course | null) =>
    {
        setOpen(null);
        void updateCoursePartial(course.id, { parentId: target?.id ?? null });
        // Snackbars are role="alert", so this is also the screen-reader
        // announcement of the move.
        enqueueSnackbar(movedCourseMessage(course, target), { variant: "success" });
    }, [ course, enqueueSnackbar, setOpen, updateCoursePartial ]);

    const label = moveCourseLabel(course);

    return (
        <>
            <Tooltip title="העברה למסלול אחר">
                <IconButton
                    aria-haspopup="menu"
                    aria-label={ label }
                    color="secondary"
                    onClick={ open }
                    onKeyDown={ (event) => event.stopPropagation() }
                    onPointerDown={ (event) => event.stopPropagation() }
                    size="small"
                >
                    <DriveFileMoveIcon className="text-[18px]" />
                </IconButton>
            </Tooltip>
            <Menu
                anchorEl={ anchorEl }
                onClose={ () => setOpen(null) }
                open={ Boolean(anchorEl) }
                slotProps={ { list: { "aria-label": label } } }
            >
                <MenuItem disabled sx={ { fontSize: "0.75rem", fontWeight: 700 } }>
                    העברה אל
                </MenuItem>
                { course.parentId ? (
                    <MenuItem onClick={ () => moveTo(null) } sx={ { fontSize: "0.8rem" } }>
                        <ListItemIcon><VerticalAlignTopIcon fontSize="small" /></ListItemIcon>
                        <ListItemText>הרמה העליונה</ListItemText>
                    </MenuItem>
                ) : null }
                { course.parentId && targets.length > 0 ? <Divider /> : null }
                { targets.map(({ course: target, depth }) => (
                    <MenuItem
                        key={ target.id }
                        onClick={ () => moveTo(target) }
                        sx={ { paddingInlineStart: 2 + depth * 2, fontSize: "0.8rem" } }
                    >
                        { target.name }
                    </MenuItem>
                )) }
                { !course.parentId && targets.length === 0 ? (
                    <MenuItem disabled sx={ { fontSize: "0.8rem" } }>אין לאן להעביר</MenuItem>
                ) : null }
            </Menu>
        </>
    );
}
