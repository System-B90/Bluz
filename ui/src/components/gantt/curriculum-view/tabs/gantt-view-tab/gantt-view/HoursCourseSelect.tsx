import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import React from "react";

import { StudentPath } from "@/components/gantt/curriculum-view/student-load";
import { createViewerSetting } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/grid-preferences";

/**
 * Whose time the gantt's scheduled-hours totals count (#899): one course's
 * students, or (null) whichever course is busiest. Shared by the grid and the
 * timeline, and remembered per viewer.
 */
export const hoursCourse = createViewerSetting<null | string>(
    "bluz.gantt.hoursCourse",
    null,
    (saved) => saved,
    (pathId) => pathId,
);

export const BUSIEST_COURSE_LABEL = "הקורס העמוס ביותר";
const SELECT_LABEL = "קורס לחישוב השעות";

/** The chosen course path, or null (busiest) when none is chosen or it no longer exists. */
export function useHoursPathId(paths: Array<StudentPath>): null | string
{
    const saved = hoursCourse.use();
    return saved !== null && paths.some((path) => path.id === saved) ? saved : null;
}

/**
 * Picks the course the hours totals are for. Hidden while there is only one
 * kind of student. Keys and clicks stay inside, so the grid's arrow keys and
 * the header's zoom-on-click don't fire through it (menu portals included).
 */
export const HoursCourseSelect: React.FC<{ paths: Array<StudentPath> }> = ({ paths }) =>
{
    const pathId = useHoursPathId(paths);
    if (paths.length < 2) return null;
    return (
        <Select
            disableUnderline
            displayEmpty
            inputProps={ { "aria-label": SELECT_LABEL } }
            onChange={ (e) => hoursCourse.set(e.target.value || null) }
            onClick={ (e) => e.stopPropagation() }
            onDoubleClick={ (e) => e.stopPropagation() }
            onKeyDown={ (e) => e.stopPropagation() }
            size="small"
            sx={ { fontSize: "0.75rem", fontWeight: "normal", maxWidth: "100%", minWidth: 0 } }
            title={ SELECT_LABEL }
            value={ pathId ?? "" }
            variant="standard"
        >
            <MenuItem dense value="">{ BUSIEST_COURSE_LABEL }</MenuItem>
            { paths.map((path) => (
                <MenuItem dense key={ path.id } value={ path.id }>{ path.label }</MenuItem>
            )) }
        </Select>
    );
};
