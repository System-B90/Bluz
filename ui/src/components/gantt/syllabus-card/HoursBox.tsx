import Box from "@mui/material/Box";
import BoxProps from "@mui/material/BoxProps";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { Gauge, gaugeClasses } from "@mui/x-charts/Gauge";
import { useMemo } from "react";

import { GanttSyllabusId } from "@/api-shared/types/gantt/models";
import { useSyllabus } from "@/components/gantt/state/hooks/UseSyllabus";
import { useGanttMappings } from "@/components/gantt/state/mappings/hooks";
import { useCurriculumState } from "@/components/gantt/state/provider";
import {
    calculateMinimumRequiredTimeForModule,
    calculateMinimumRequiredTimeForSyllabus,
} from "@/components/gantt/utils";

export type HoursBoxProps = {
    syllabusId: GanttSyllabusId;
} & BoxProps;

export function HoursBox({ syllabusId, ...props }: HoursBoxProps) {
    const state = useCurriculumState();
    const syllabus = useSyllabus(syllabusId);
    const { state: mappingState } = useGanttMappings();
    const mappings = mappingState.mappings;

    const minimumRequiredHours = syllabus
        ? calculateMinimumRequiredTimeForSyllabus(syllabus, state)
        : 0;
    const wantedHours = 0;

    const scheduledHours = useMemo(() => {
        if (!syllabus || !mappings) return 0;
        const moduleIdsSet = new Set(syllabus.modules);
        let totalMinutes = 0;
        for (const mapping of Object.values(mappings)) {
            if (moduleIdsSet.has(mapping.moduleId)) {
                if (mapping.eventId) {
                    totalMinutes +=
                        state.events[mapping.eventId]?.minimumDuration ?? 0;
                } else {
                    const moduleDoc = state.modules[mapping.moduleId];
                    if (moduleDoc) {
                        totalMinutes += calculateMinimumRequiredTimeForModule(
                            moduleDoc,
                            state,
                        );
                    }
                }
            }
        }
        return totalMinutes;
    }, [syllabus, mappings, state]);

    const progressPercentage =
        minimumRequiredHours > 0
            ? Math.min((scheduledHours / minimumRequiredHours) * 100, 100)
            : 0;

    return (
        <Box {...props}>
            <Box alignItems="center" display="flex" flexDirection="row" gap={1}>
                <Gauge
                    height={60}
                    sx={{
                        [`& .${gaugeClasses.valueText}`]: {
                            fontSize: "0.75rem",
                            transform: "translate(0px, -1px)",
                        },
                    }}
                    text={`${Math.round(progressPercentage)}%`}
                    value={progressPercentage}
                    width={60}
                />
                <Stack spacing={0}>
                    <Box
                        alignItems="baseline"
                        display="flex"
                        flexDirection="row"
                        gap={1}
                    >
                        <Typography
                            color="text.secondary"
                            fontSize="0.8rem"
                            variant="body2"
                        >
                            שובצו:
                        </Typography>
                        <Typography
                            fontSize="0.8rem"
                            fontWeight="bold"
                            variant="body2"
                        >
                            {scheduledHours}
                        </Typography>
                    </Box>
                    <Box
                        alignItems="baseline"
                        display="flex"
                        flexDirection="row"
                        gap={1}
                    >
                        <Typography
                            color="text.secondary"
                            fontSize="0.8rem"
                            variant="body2"
                        >
                            מינימום:
                        </Typography>
                        <Typography
                            fontSize="0.8rem"
                            fontWeight="bold"
                            variant="body2"
                        >
                            {minimumRequiredHours}
                        </Typography>
                    </Box>
                    <Box
                        alignItems="baseline"
                        display="flex"
                        flexDirection="row"
                        gap={1}
                    >
                        <Typography
                            color="text.secondary"
                            fontSize="0.8rem"
                            variant="body2"
                        >
                            אידיאל:
                        </Typography>
                        <Typography
                            fontSize="0.8rem"
                            fontWeight="bold"
                            variant="body2"
                        >
                            {wantedHours}
                        </Typography>
                    </Box>
                </Stack>
            </Box>
        </Box>
    );
}
