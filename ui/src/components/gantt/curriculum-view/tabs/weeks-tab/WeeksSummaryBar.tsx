import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import LinearProgress from "@mui/material/LinearProgress";
import Typography from "@mui/material/Typography";
import { useMemo } from "react";

import { NormalizedStore } from "@/api-client/gantt/drizzle-normalize";
import { GanttCurriculum } from "@/api-shared/types/gantt/models";
import {
    formatHours,
    formatHoursLabel,
    getCurriculumScheduledMinutes,
    getCurriculumTotalWorkingMinutes,
} from "@/components/gantt/curriculum-view/gantt-time-utils";
import { useGanttMappings } from "@/components/gantt/state/mappings/hooks";
import { calculateMinimumRequiredTimeForCurriculum } from "@/components/gantt/utils";

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
        <Box
            minWidth={112}
            sx={{
                transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                "&:hover": {
                    transform: "translateY(-1px)",
                },
            }}
        >
            <Typography
                color="text.secondary"
                sx={{ fontWeight: 600, letterSpacing: "0.01em" }}
                variant="caption"
            >
                {label}
            </Typography>
            <Typography
                color={tone === "default" ? "text.primary" : `${tone}.main`}
                fontWeight={800}
                sx={{
                    fontSize: "0.95rem",
                    mt: 0.25,
                    fontFamily: "Assistant, sans-serif",
                }}
                variant="subtitle2"
            >
                {value}
            </Typography>
        </Box>
    );
}

export function WeeksSummaryBar({ curriculum, state }: WeeksSummaryBarProps) {
    const { state: mappingState } = useGanttMappings();
    const mappings = mappingState.mappings;

    const {
        scheduledMinutes,
        minimumMinutes,
        remainingMinutes,
        totalWorkingMinutes,
        utilization,
    } = useMemo(() => {
        const total = getCurriculumTotalWorkingMinutes(curriculum, state);
        const minimum = calculateMinimumRequiredTimeForCurriculum(
            curriculum,
            state,
        );
        const scheduled = getCurriculumScheduledMinutes({
            curriculum,
            mappings,
            state,
        });

        return {
            totalWorkingMinutes: total,
            minimumMinutes: minimum,
            scheduledMinutes: scheduled,
            remainingMinutes: total - scheduled,
            utilization:
                total > 0 ? Math.min((scheduled / total) * 100, 100) : 0,
        };
    }, [curriculum, state, mappings]);

    const remainingTone = remainingMinutes < 0 ? "error" : "primary";

    return (
        <Box
            alignItems="center"
            display="flex"
            flexWrap="wrap"
            gap={2.5}
            sx={{
                border: "1px solid",
                borderColor: "divider",
                borderRadius: "12px",
                p: 2,
                bgcolor: "background.paper",
                boxShadow: "0 2px 12px rgba(0, 0, 0, 0.02)",
            }}
        >
            <SummaryMetric
                label="משך הקורס"
                value={`${curriculum.weeks.length} שבועות`}
            />
            <Divider flexItem orientation="vertical" />
            <SummaryMetric
                label="שעות זמינות"
                value={formatHoursLabel(totalWorkingMinutes)}
            />
            <SummaryMetric
                label="מינימום דרוש"
                value={formatHoursLabel(minimumMinutes)}
            />
            <SummaryMetric
                label="שובצו"
                value={formatHoursLabel(scheduledMinutes)}
            />
            <SummaryMetric
                label={remainingMinutes < 0 ? "חריגה" : "יתרה"}
                tone={remainingTone}
                value={formatHoursLabel(Math.abs(remainingMinutes))}
            />
            <Box
                flex={1}
                minWidth={180}
                sx={{
                    bgcolor: (theme) =>
                        theme.palette.mode === "light"
                            ? "rgba(103, 200, 221, 0.04)"
                            : "rgba(12, 34, 55, 0.2)",
                    p: 1.5,
                    borderRadius: "10px",
                    border: "1px solid",
                    borderColor: "divider",
                    transition: "all 0.25s ease",
                    "&:hover": {
                        borderColor: "primary.main",
                        boxShadow: "0 4px 12px rgba(103, 200, 221, 0.08)",
                    },
                }}
            >
                <Box
                    alignItems="center"
                    display="flex"
                    justifyContent="space-between"
                >
                    <Typography
                        color="text.secondary"
                        sx={{ fontWeight: 600 }}
                        variant="caption"
                    >
                        ניצול
                    </Typography>
                    <Chip
                        color={remainingMinutes < 0 ? "error" : "primary"}
                        label={`${formatHours(scheduledMinutes)} / ${formatHours(totalWorkingMinutes)} ש׳`}
                        size="small"
                        sx={{
                            fontWeight: 700,
                            borderRadius: "6px",
                            fontSize: "0.75rem",
                            bgcolor: "background.paper",
                        }}
                        variant="outlined"
                    />
                </Box>
                <LinearProgress
                    color={remainingMinutes < 0 ? "error" : "primary"}
                    sx={{ mt: 1, height: 6, borderRadius: 3 }}
                    value={utilization}
                    variant="determinate"
                />
            </Box>
        </Box>
    );
}
