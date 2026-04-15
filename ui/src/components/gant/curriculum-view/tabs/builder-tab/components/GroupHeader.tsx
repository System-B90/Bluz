import { WorkTimeChip } from "@/components/gant/curriculum-view/tabs/weeks-tab/WeekPanel";
import { Box, BoxProps, Typography } from "@mui/material";

export interface GroupHeaderProps extends BoxProps
{
    start: number;
    end: number;
    totalHours: number;
}

export default function GroupHeader({ start, end, totalHours, ...props }: GroupHeaderProps)
{
    return (
        <Box { ...props } className="flex items-center justify-between mb-4">
            <Typography variant="h6" fontWeight="bold">
                שבועות { start } - { end }
            </Typography>
            <WorkTimeChip totalHours={ totalHours } />
        </Box>
    );
}
