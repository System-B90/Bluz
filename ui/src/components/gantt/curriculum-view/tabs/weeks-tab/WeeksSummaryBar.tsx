import { Box, Chip, Divider, LinearProgress, Typography } from "@mui/material";
import { useMemo } from "react";

import { NormalizedStore } from "@/api-client/gantt/drizzle-normalize";
import { GanttCurriculum } from "@/api-shared/types/gantt/models";
import {
    formatHours,
    formatHoursLabel,
    getCurriculumTotalWorkingMinutes,
} from "@/components/gantt/curriculum-view/gantt-time-utils";
import {
    calculateAllocatedTimeForCurriculum,
    calculateMinimumRequiredTimeForCurriculum,
} from "@/components/gantt/utils";

export type WeeksSummaryBarProps = {
  curriculum: GanttCurriculum;
  state: NormalizedStore;
};

function SummaryMetric({
    label,
    tone = "default",
    value,
}: {
  label: string;
  tone?: "default" | "error" | "primary" | "warning";
  value: string;
}) {
    return (
        <Box minWidth={112}>
            <Typography color="text.secondary" variant="caption">
                {label}
            </Typography>
            <Typography
                color={tone === "default" ? "text.primary" : `${tone}.main`}
                fontWeight={700}
                variant="subtitle2"
            >
                {value}
            </Typography>
        </Box>
    );
}

export function WeeksSummaryBar({
    curriculum,
    state,
}: WeeksSummaryBarProps) {
    const {
        allocatedMinutes,
        minimumMinutes,
        remainingMinutes,
        totalWorkingMinutes,
        utilization,
    } = useMemo(() => {
        const total = getCurriculumTotalWorkingMinutes(curriculum, state);
        const minimum = calculateMinimumRequiredTimeForCurriculum(curriculum, state);
        const allocated = calculateAllocatedTimeForCurriculum(curriculum, state);

        return {
            totalWorkingMinutes: total,
            minimumMinutes: minimum,
            allocatedMinutes: allocated,
            remainingMinutes: total - allocated,
            utilization: total > 0 ? Math.min((allocated / total) * 100, 100) : 0,
        };
    }, [curriculum, state]);

    const remainingTone = remainingMinutes < 0 ? "error" : "primary";

    return (
        <Box
            alignItems="center"
            display="flex"
            flexWrap="wrap"
            gap={2}
            sx={{
                border: 1,
                borderColor: "divider",
                borderRadius: 1,
                p: 1.5,
                bgcolor: "background.paper",
            }}
        >
            <SummaryMetric label="משך הקורס" value={`${curriculum.weeks.length} שבועות`} />
            <Divider flexItem orientation="vertical" />
            <SummaryMetric label="שעות זמינות" value={formatHoursLabel(totalWorkingMinutes)} />
            <SummaryMetric label="מינימום דרוש" value={formatHoursLabel(minimumMinutes)} />
            <SummaryMetric label="הוקצו" value={formatHoursLabel(allocatedMinutes)} />
            <SummaryMetric
                label={remainingMinutes < 0 ? "חריגה" : "יתרה"}
                tone={remainingTone}
                value={formatHoursLabel(Math.abs(remainingMinutes))}
            />
            <Box flex={1} minWidth={180}>
                <Box alignItems="center" display="flex" justifyContent="space-between">
                    <Typography color="text.secondary" variant="caption">
            ניצול
                    </Typography>
                    <Chip
                        color={remainingMinutes < 0 ? "error" : "primary"}
                        label={`${formatHours(allocatedMinutes)} / ${formatHours(totalWorkingMinutes)} ש׳`}
                        size="small"
                        variant="outlined"
                    />
                </Box>
                <LinearProgress
                    color={remainingMinutes < 0 ? "error" : "primary"}
                    sx={{ mt: 0.75, height: 6, borderRadius: 1 }}
                    value={utilization}
                    variant="determinate"
                />
            </Box>
        </Box>
    );
}
