import MenuIcon from "@mui/icons-material/Menu";
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

/**
 * Gantt page toolbar, inline with the tab names on the opposite side.
 * Folds into a burger menu when the viewport is too narrow.
 */
export function GanttPageToolbar()
{
    const narrow = useMediaQuery(useTheme().breakpoints.down("md"));
    const [ anchor, setAnchor ] = useState<HTMLElement | null>(null);
    const items = <HoursFormatToggle />;

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
