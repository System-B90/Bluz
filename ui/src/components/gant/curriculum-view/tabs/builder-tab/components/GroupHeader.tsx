import ExpandIcon from '@mui/icons-material/Expand';
import { Box, BoxProps, IconButton, Typography } from "@mui/material";

import { WorkTimeChip } from "@/components/gant/curriculum-view/tabs/weeks-tab/WeekPanel";

export interface GroupHeaderProps extends Omit<BoxProps, 'onClick'>
{
    start: number;
    end: number;
    totalHours: number;
    onExpandGroup: () => void;
}

export function GroupHeader({ start, end, totalHours, onExpandGroup, ...props }: GroupHeaderProps)
{
    return (
        <Box { ...props } className="flex items-start justify-between mb-0" >
            <Box className="flex items-center gap-2" >
                <Typography fontWeight="bold" variant="h6">
                    שבועות { start } - { end }
                </Typography>
            </Box>
            <Box className='flex flex-col items-end' gap={ 1 }>
                <WorkTimeChip totalHours={ totalHours } />
                <IconButton color="info" onClick={ onExpandGroup } sx={ { mr: -1 } }>
                    <ExpandIcon className='rotate-90' color="info" />
                </IconButton>
            </Box>
        </Box>
    );
}
