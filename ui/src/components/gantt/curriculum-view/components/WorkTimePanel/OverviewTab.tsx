import { Box, Stack, Typography } from "@mui/material";
import { useMemo } from "react";

import {
    GanttCurriculumId,
    GanttWeekId,
} from "@/api-shared/types/gantt/models";
import { WeekWorkTimeChip } from "@/components/gantt/curriculum-view/tabs/weeks-tab/WeekPanel";
import { useCurriculumWeek } from "@/components/gantt/state/hooks/UseWeek";

function WeekOverview({ weekId, weekIndex }: { weekId: GanttWeekId; weekIndex: number }) {
    const week = useCurriculumWeek(weekId);

    if (!week) return null;

    return (
        <Box
            key={weekId}
            sx={{ border: 1, borderColor: "divider", borderRadius: 1, p: 1 }}
        >
            <Box
                alignItems="baseline"
                display="flex"
                justifyContent="space-between"
                mb={0.5}
            >
                <Typography variant="subtitle2">{`שבוע ${weekIndex + 1}`}</Typography>
                <WeekWorkTimeChip weekId={weekId} />
            </Box>
            <Typography color="text.secondary" variant="body2">
                {week.comment?.trim() || "ללא הערה"}
            </Typography>
        </Box>
    );
}

export function OverviewTab({
    weeks,
}: {
  curriculumId: GanttCurriculumId;
  weeks: Array<GanttWeekId>;
}) {
    const overviews = useMemo(
        () => weeks.map((weekId, index) => <WeekOverview key={weekId} weekId={weekId} weekIndex={index} />),
        [weeks],
    );

    return (
        <Box sx={{ overflowY: "scroll", paddingInlineEnd: 1 }}>
            <Stack spacing={1}>{overviews}</Stack>
        </Box>
    );
}
