import { CurriculumWeek } from "@/api-shared/types/gant/curriculum";
import GroupHeader from "@/components/gant/curriculum-view/tabs/builder-tab/components/GroupHeader";
import { calculateTotalWorkingTimeForWeeks } from "@/components/gant/curriculum-view/tabs/builder-tab/components/utils";
import { Box, BoxProps, Divider } from "@mui/material";
import { useMemo } from "react";

export interface WeekGroupPanelProps extends BoxProps
{
    group: Array<CurriculumWeek>;
    allWeeks: Array<CurriculumWeek>;
}

export default function WeekGroupPanel({ group, allWeeks, ...props }: WeekGroupPanelProps)
{
    const startWeek = allWeeks.indexOf(group[ 0 ]) + 1;
    const endWeek = allWeeks.indexOf(group[ group.length - 1 ]) + 1;

    const totalTime = useMemo(
        () => calculateTotalWorkingTimeForWeeks(group),
        [ group ]
    );

    return (
        <Box
            { ...props }
            className="flex flex-1 flex-col p-4 min-w-75 gap-4"
        >
            <GroupHeader start={ startWeek } end={ endWeek } totalHours={ totalTime } />
            <Divider />
            <Box className="flex flex-col gap-2">
                {/** Keep this empty for now */ }
            </Box>
        </Box>
    );
}
