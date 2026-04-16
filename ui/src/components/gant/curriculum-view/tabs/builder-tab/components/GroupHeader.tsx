/**
 * Name: GroupHeader.tsx
 * Purpose: Header for the WeekGroupPanel with separate expansion and selection triggers.
 * Created: 2026-04-16
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
        <Box { ...props } className="flex items-center justify-between mb-2">
            <Box className="flex items-center gap-2 grow cursor-pointer" onClick={ onSelectGroup }>
                <Typography variant="h6" fontWeight="bold">
                    שבועות { start } - { end }
                </Typography>
            </Box>

            <Box className="flex items-center gap-2">
                <WorkTimeChip totalHours={ totalHours } />
                <IconButton
                    size="small"
                    onClick={ onToggleExpand }
                    className={ `transition-transform duration-300 ${isExpanded ? "rotate-0" : "-rotate-90"}` }
                >
                    <ExpandMoreIcon />
                </IconButton>
            </Box>
        </Box>
    );
}