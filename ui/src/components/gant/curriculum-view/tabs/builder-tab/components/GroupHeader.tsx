/**
 * Name: GroupHeader.tsx
 * Purpose: Header for the WeekGroupPanel with separate expand and select triggers.
 * Created: 2026-04-16
 * Author: Michael K. Steinberg
 */

import { WorkTimeChip } from "@/components/gant/curriculum-view/tabs/weeks-tab/WeekPanel";
import { ExpandMore as ExpandMoreIcon } from "@mui/icons-material";
import { Box, BoxProps, IconButton, Tooltip, Typography } from "@mui/material";

export interface GroupHeaderProps extends Omit<BoxProps, 'onClick'>
{
    start: number;
    end: number;
    totalHours: number;
    isExpanded: boolean;
    onToggleExpand: (e: React.MouseEvent) => void;
    onSelectGroup: () => void;
}

export default function GroupHeader({
    start,
    end,
    totalHours,
    isExpanded,
    onToggleExpand,
    onSelectGroup,
    ...props
}: GroupHeaderProps)
{
    return (
        <Box
            { ...props }
            className="flex items-center justify-between group/header"
        >
            <Box
                className="flex items-center gap-1 cursor-pointer grow"
                onClick={ onSelectGroup }
            >
                <Tooltip title={ isExpanded ? "Collapse" : "Expand" }>
                    <IconButton
                        size="small"
                        onClick={ onToggleExpand }
                        className={ `transition-transform duration-300 ease-in-out ${isExpanded ? "rotate-0" : "-rotate-90"}` }
                    >
                        <ExpandMoreIcon />
                    </IconButton>
                </Tooltip>

                <Typography variant="h6" fontWeight="bold" className="group-hover/header:text-blue-600 transition-colors">
                    שבועות { start } - { end }
                </Typography>
            </Box>

            <WorkTimeChip totalHours={ totalHours } />
        </Box>
    );
}
