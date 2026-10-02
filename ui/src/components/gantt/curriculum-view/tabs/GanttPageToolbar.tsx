import AnimationIcon from "@mui/icons-material/Animation";
import CompressIcon from "@mui/icons-material/Compress";
import FreeBreakfastIcon from "@mui/icons-material/FreeBreakfast";
import MenuIcon from "@mui/icons-material/Menu";
import UnfoldLessIcon from "@mui/icons-material/UnfoldLess";
import UnfoldMoreIcon from "@mui/icons-material/UnfoldMore";
import ViewColumnIcon from "@mui/icons-material/ViewColumn";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import Popover from "@mui/material/Popover";
import Stack from "@mui/material/Stack";
import { useTheme } from "@mui/material/styles";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Tooltip from "@mui/material/Tooltip";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useState } from "react";

import { HoursFormat, setHoursFormat } from "@/components/gantt/curriculum-view/gantt-time-utils";
import { requestGridExpansion, useGridAllCollapsed } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/grid-expansion-bus";
import {
    setGridAnimation,
    setGridCompactHeader,
    setGridIgnoreBreaks,
    setGridVerticalLines,
    useGridAnimation,
    useGridCompactHeader,
    useGridIgnoreBreaks,
    useGridVerticalLines,
} from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/grid-preferences";
import { useHoursFormat } from "@/components/gantt/curriculum-view/use-hours-format";

function HoursFormatToggle()
{
    const hoursFormat = useHoursFormat();
    return (
        <Tooltip title="תצוגת שעות">
            <ToggleButtonGroup
                aria-label="תצוגת שעות"
                exclusive
                onChange={ (_, value: HoursFormat | null) => value && setHoursFormat(value) }
                size="small"
                value={ hoursFormat }
            >
                <ToggleButton value="decimal">0.75</ToggleButton>
                <ToggleButton value="clock">0:45</ToggleButton>
            </ToggleButtonGroup>
        </Tooltip>
    );
}

function GridAnimationToggle()
{
    const animated = useGridAnimation();
    return (
        <Tooltip title="אנימציית פתיחה וסגירה בטבלה">
            <ToggleButton
                aria-label="אנימציית פתיחה וסגירה בטבלה"
                onChange={ () => setGridAnimation(!animated) }
                selected={ animated }
                size="small"
                value="animation"
            >
                <AnimationIcon fontSize="small" />
            </ToggleButton>
        </Tooltip>
    );
}

function GridExpandAllButton()
{
    const allCollapsed = useGridAllCollapsed();
    const label = allCollapsed ? "להרחיב את כל השורות" : "לכווץ את כל השורות";
    return (
        <Tooltip title={ label }>
            <IconButton aria-label={ label } onClick={ () => requestGridExpansion(allCollapsed ? "expand" : "collapse") } size="small">
                { allCollapsed ? <UnfoldMoreIcon fontSize="small" /> : <UnfoldLessIcon fontSize="small" /> }
            </IconButton>
        </Tooltip>
    );
}

function GridCompactHeaderToggle()
{
    const compact = useGridCompactHeader();
    return (
        <Tooltip title="שורת זמן משובץ / זמין אחת בכותרת">
            <ToggleButton
                aria-label="שורת זמן משובץ / זמין אחת בכותרת"
                onChange={ () => setGridCompactHeader(!compact) }
                selected={ compact }
                size="small"
                value="compact"
            >
                <CompressIcon fontSize="small" />
            </ToggleButton>
        </Tooltip>
    );
}

function GridIgnoreBreaksToggle()
{
    const ignored = useGridIgnoreBreaks();
    return (
        <Tooltip title="התעלמות מהפסקות בסכומי הזמן">
            <ToggleButton
                aria-label="התעלמות מהפסקות בסכומי הזמן בטבלה"
                onChange={ () => setGridIgnoreBreaks(!ignored) }
                selected={ ignored }
                size="small"
                sx={ { gap: 0.5 } }
                value="breaks"
            >
                <FreeBreakfastIcon fontSize="small" />
                ללא הפסקות
            </ToggleButton>
        </Tooltip>
    );
}

function GridVerticalLinesToggle()
{
    const lines = useGridVerticalLines();
    return (
        <Tooltip title="קווים אנכיים בטבלה">
            <ToggleButton
                aria-label="קווים אנכיים בטבלה"
                onChange={ () => setGridVerticalLines(!lines) }
                selected={ lines }
                size="small"
                value="lines"
            >
                <ViewColumnIcon fontSize="small" />
            </ToggleButton>
        </Tooltip>
    );
}

/**
 * Gantt page toolbar, inline with the tab names on the opposite side.
 * Folds into a burger menu when the viewport is too narrow.
 */
export function GanttPageToolbar()
{
    const narrow = useMediaQuery(useTheme().breakpoints.down("md"));
    const [ anchor, setAnchor ] = useState<HTMLElement | null>(null);
    const divider = <Divider flexItem orientation={ narrow ? "horizontal" : "vertical" } />;
    const items = (
        <>
            { /* Row tree, then table layout, then what the numbers count and how they read, then motion. */ }
            <GridExpandAllButton />
            { divider }
            <GridCompactHeaderToggle />
            <GridVerticalLinesToggle />
            { divider }
            <GridIgnoreBreaksToggle />
            <HoursFormatToggle />
            { divider }
            <GridAnimationToggle />
        </>
    );

    if (!narrow) return <Stack alignItems="center" direction="row" gap={ 1 }>{ items }</Stack>;
    return (
        <>
            <IconButton aria-label="סרגל כלים" onClick={ (e) => setAnchor(e.currentTarget) } size="small">
                <MenuIcon />
            </IconButton>
            <Popover
                anchorEl={ anchor }
                anchorOrigin={ { vertical: "bottom", horizontal: "left" } }
                onClose={ () => setAnchor(null) }
                open={ !!anchor }
            >
                <Stack gap={ 1 } p={ 1 }>{ items }</Stack>
            </Popover>
        </>
    );
}
