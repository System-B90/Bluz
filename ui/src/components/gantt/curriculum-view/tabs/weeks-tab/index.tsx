/**
 * Name: WeeksTab.tsx
 * Purpose: Container for horizontal scrolling week panels in Bluz.
 * Created: 2026-04-14
 * Author: Michael K. Steinberg
 */

import { Box, Paper, Skeleton, Stack } from "@mui/material";
import { memo, useMemo } from "react";

import {
    GanttCurriculumId,
    GanttWeekId,
} from "@/api-shared/types/gantt/models";
import { useProgressiveItemCount } from "@/components/gantt/curriculum-view/tabs/UseProgressiveItemCount";
import { WeekPanel } from "@/components/gantt/curriculum-view/tabs/weeks-tab/WeekPanel";
import { useCurriculum } from "@/components/gantt/state/hooks/UseCurriculum";

type WeeksTabProps = {
  curriculumId: GanttCurriculumId;
};

const INITIAL_WEEK_PANEL_COUNT = 2;
const WEEK_PANEL_BATCH_SIZE = 3;
const MAX_WEEK_PANEL_SKELETONS = 3;
const EMPTY_WEEK_IDS: Array<GanttWeekId> = [];

function WeekPanelSkeleton() {
    return (
        <Paper
            elevation={1}
            sx={{
                minWidth: 300,
                p: 2,
                display: "flex",
                flexDirection: "column",
                gap: 1.5,
                borderRadius: 2,
                bgcolor: "background.paper",
            }}
        >
            <Box
                alignItems="flex-start"
                display="flex"
                gap={1}
                justifyContent="space-between"
            >
                <Box flex={1}>
                    <Skeleton height={18} width="35%" />
                    <Skeleton height={24} width="80%" />
                </Box>
                <Box alignItems="flex-end" display="flex" flexDirection="column" gap={1}>
                    <Skeleton height={24} variant="rounded" width={88} />
                    <Skeleton height={24} variant="rounded" width={104} />
                </Box>
            </Box>
            <Skeleton height={1} variant="rectangular" />
            <Stack spacing={1}>
                {Array.from({ length: 4 }).map((_, index) => (
                    <Skeleton height={58} key={index} variant="rounded" />
                ))}
            </Stack>
        </Paper>
    );
}

export const WeeksTab = memo(function WeeksTab({
    curriculumId,
}: WeeksTabProps) {
    const curriculum = useCurriculum(curriculumId);
    const weeks = curriculum?.weeks ?? EMPTY_WEEK_IDS;
    const visibleWeekCount = useProgressiveItemCount(weeks.length, {
        batchSize: WEEK_PANEL_BATCH_SIZE,
        initialCount: INITIAL_WEEK_PANEL_COUNT,
        resetKey: curriculumId,
    });
    const hiddenWeekCount = weeks.length - visibleWeekCount;

    const renderedPanels = useMemo(
        () =>
            weeks.slice(0, visibleWeekCount).map((weekId: GanttWeekId) => (
                <WeekPanel curriculumId={curriculumId} key={weekId} weekId={weekId} />
            )),
        [curriculumId, visibleWeekCount, weeks],
    );

    return (
        <Box
            display={"flex"}
            flexDirection={"column"}
            flexGrow={1}
            gap={2}
            height={"100%"}
        >
            <Box
                display="flex"
                flexDirection="column"
                gap={1}
                height={"100%"}
                width={"100%"}
            >
                <Box
                    alignContent={"flex-start"}
                    display={"flex"}
                    flexDirection={"column"}
                    flexWrap={"wrap"}
                    gap={2}
                    height={"100%"}
                    sx={{ overflowX: "scroll" }}
                >
                    {renderedPanels}
                    {Array.from({
                        length: Math.min(hiddenWeekCount, MAX_WEEK_PANEL_SKELETONS),
                    }).map((_, index) => (
                        <WeekPanelSkeleton key={`week-panel-skeleton-${index}`} />
                    ))}
                </Box>
            </Box>
        </Box>
    );
});
