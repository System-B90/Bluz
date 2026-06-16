import ExpandIcon from "@mui/icons-material/Expand";
import Box, { BoxProps } from "@mui/material/Box";

import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";

import { WorkTimeChip } from "@/components/gantt/curriculum-view/tabs/weeks-tab/WeekPanel";

export type GroupHeaderProps = {
    start: number;
    end: number;
    totalHours: number;
    onExpandGroup: () => void;
} & Omit<BoxProps, "onClick">;

export function GroupHeader({
    start,
    end,
    totalHours,
    onExpandGroup,
    ...props
}: GroupHeaderProps) {
    return (
        <Box {...props} className="flex items-start justify-between mb-0">
            <Box className="flex items-center gap-2">
                <Typography fontWeight="bold" variant="h6">
                    שבועות {start} - {end}
                </Typography>
            </Box>
            <Box className="flex flex-col items-end" gap={1}>
                <WorkTimeChip totalHours={totalHours} />
                <IconButton
                    color="info"
                    onClick={onExpandGroup}
                    sx={{ mr: -1 }}
                >
                    <ExpandIcon className="rotate-90" color="info" />
                </IconButton>
            </Box>
        </Box>
    );
}
