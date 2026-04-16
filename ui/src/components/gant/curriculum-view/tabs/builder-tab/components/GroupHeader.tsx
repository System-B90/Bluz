/**
 * Name: GroupHeader.tsx
 * Purpose: Header for the WeekGroupPanel with expansion toggle.
 * Created: 2026-04-15
 * Author: Michael K. Steinberg
 */

import { WorkTimeChip } from "@/components/gant/curriculum-view/tabs/weeks-tab/WeekPanel";
import { ExpandMore as ExpandMoreIcon } from "@mui/icons-material";
import { Box, BoxProps, IconButton, Typography } from "@mui/material";

export interface GroupHeaderProps extends Omit<BoxProps, 'onClick'>
{
    start: number;
    end: number;
    totalHours: number;
    isExpanded: boolean;
    onExpandGroup: () => void;
}

export default function GroupHeader({
    start,
    end,
    totalHours,
    isExpanded,
    onExpandGroup,
    ...props
}: GroupHeaderProps)
{
    return (
        <Box
            { ...props }
            className="flex items-center justify-between mb-2 cursor-pointer group"
            onClick={ onExpandGroup }
        >
            <Box className="flex items-center gap-2">
                <IconButton
                    size="small"
                    className={ `transition-transform duration-300 ${isExpanded ? "rotate-180" : "rotate-0"}` }
                    sx={ { color: 'text.secondary' } }
                >
                    <ExpandMoreIcon />
                </IconButton>
                <Typography variant="h6" fontWeight="bold">
                    שבועות { start } - { end }
                </Typography>
            </Box>
            <WorkTimeChip totalHours={ totalHours } />
        </Box>
    );
}
