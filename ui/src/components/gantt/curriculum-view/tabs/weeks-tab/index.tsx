/**
 * Name: WeeksTab.tsx
 * Purpose: Dense course-duration and capacity editor for Bluz Gantt weeks.
 * Created: 2026-04-14
 * Author: Michael K. Steinberg
 */

import { Box, CircularProgress, Paper, Stack, Typography } from "@mui/material";
import { memo } from "react";

import { GanttCurriculumId } from "@/api-shared/types/gantt/models";
import { CourseStartDateControl } from "@/components/gantt/curriculum-view/tabs/weeks-tab/CourseStartDateControl";
import { WeekLengthMenu } from "@/components/gantt/curriculum-view/tabs/weeks-tab/WeekLengthMenu";
import { WeeksCapacityGrid } from "@/components/gantt/curriculum-view/tabs/weeks-tab/WeeksCapacityGrid";
import { WeeksSummaryBar } from "@/components/gantt/curriculum-view/tabs/weeks-tab/WeeksSummaryBar";
import { useCurriculum } from "@/components/gantt/state/hooks/UseCurriculum";
import { useGanttMappings } from "@/components/gantt/state/mappings/hooks";
import { GanttMappingProvider } from "@/components/gantt/state/mappings/Provider";
import { useCurriculumState } from "@/components/gantt/state/provider";

type WeeksTabProps = {
  curriculumId: GanttCurriculumId;
};

function WeeksTabInner({ curriculumId }: WeeksTabProps) {
    const curriculum = useCurriculum(curriculumId);
    const state = useCurriculumState();
    const {
        state: { isLoading, mappings },
    } = useGanttMappings();

    if (!curriculum) {
        return (
            <Box alignItems="center" display="flex" flex={1} justifyContent="center">
                <CircularProgress size={28} />
            </Box>
        );
    }

    return (
        <Box display="flex" flexDirection="column" gap={1.5} height="100%" minHeight={0}>
            <Paper
                elevation={0}
                sx={{
                    position: "sticky",
                    top: 0,
                    zIndex: 8,
                    p: 1.5,
                    border: 1,
                    borderColor: "divider",
                    borderRadius: 1,
                    bgcolor: "background.default",
                }}
            >
                <Stack spacing={1.5}>
                    <Box
                        alignItems="center"
                        display="flex"
                        flexWrap="wrap"
                        gap={2}
                        justifyContent="space-between"
                    >
                        <Box>
                            <Typography fontWeight={700} variant="h6">
                שבועות
                            </Typography>
                            <Typography color="text.secondary" variant="body2">
                אורך הקורס, תאריכים, שעות זמינות ושבתות בבסיס
                            </Typography>
                        </Box>
                        <WeekLengthMenu curriculum={curriculum} curriculumId={curriculumId} />
                    </Box>
                    <CourseStartDateControl
                        curriculum={curriculum}
                        curriculumId={curriculumId}
                    />
                    <WeeksSummaryBar curriculum={curriculum} state={state} />
                    {isLoading ? (
                        <Typography color="text.secondary" variant="caption">
              טוען שיבוצים קיימים...
                        </Typography>
                    ) : null}
                </Stack>
            </Paper>
            <WeeksCapacityGrid
                curriculum={curriculum}
                mappings={mappings}
                state={state}
            />
        </Box>
    );
}

export const WeeksTab = memo(function WeeksTab({ curriculumId }: WeeksTabProps) {
    return (
        <GanttMappingProvider curriculumId={curriculumId}>
            <WeeksTabInner curriculumId={curriculumId} />
        </GanttMappingProvider>
    );
});
