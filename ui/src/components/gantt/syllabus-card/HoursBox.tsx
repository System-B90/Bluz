import Box, { BoxProps } from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { Gauge, gaugeClasses } from "@mui/x-charts/Gauge";
import { useMemo } from "react";

import { GanttSyllabusId } from "@/api-shared/types/gantt/models";
import { getTentativeMinutesForModuleIds } from "@/components/gantt/curriculum-view/gantt-time-utils";
import { useSyllabus } from "@/components/gantt/state/hooks/UseSyllabus";
import { useGanttMappings } from "@/components/gantt/state/mappings/hooks";
import { useCurriculumState } from "@/components/gantt/state/provider";
import { calculateMinimumRequiredTimeForSyllabus } from "@/components/gantt/utils";

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

    const tentativeHours = useMemo(() => {
        if (!syllabus || !mappings) return 0;
        return getTentativeMinutesForModuleIds({
            mappings,
            moduleIds: syllabus.modules,
            state,
        });
    }, [syllabus, mappings, state]);

    const scheduledHours = useMemo(() => {
        if (!syllabus || !mappings) return 0;
        const moduleIdsSet = new Set(syllabus.modules);
        // Allocated time only comes from allocated events, never a whole
        // module. A module's total is the sum of its own allocated events -
        // 0 if none allocated, partial if only some are. An event mapped
        // across multiple days produces one mapping row per day; count once.
        const seen = new Set<string>();
        let totalMinutes = 0;
        for (const mapping of Object.values(mappings)) {
            if (!moduleIdsSet.has(mapping.moduleId)) continue;
            if (!mapping.eventId) continue;
            if (seen.has(mapping.eventId)) continue;
            seen.add(mapping.eventId);

            totalMinutes += state.events[mapping.eventId]?.minimumDuration ?? 0;
        }
        return totalMinutes;
    }, [syllabus, mappings, state]);

    const progressPercentage =
        minimumRequiredHours > 0
            ? Math.min((scheduledHours / minimumRequiredHours) * 100, 100)
            : 0;
    const tentativePercentage =
        minimumRequiredHours > 0
            ? Math.min((tentativeHours / minimumRequiredHours) * 100, 100)
            : 0;

    return (
        <Box {...props}>
            <Box alignItems="center" display="flex" flexDirection="row" gap={1}>
                <Box sx={{ position: "relative", height: 60, width: 60 }}>
                    <Box sx={{ position: "absolute", insetInlineStart: 0, top: 0 }}>
                        <Gauge
                            height={60}
                            sx={{
                                [`& .${gaugeClasses.valueArc}`]: { opacity: 0.35 },
                                [`& .${gaugeClasses.valueText}`]: { display: "none" },
                            }}
                            value={tentativePercentage}
                            width={60}
                        />
                    </Box>
                    <Box sx={{ position: "absolute", insetInlineStart: 0, top: 0 }}>
                        <Gauge
                            height={60}
                            sx={{
                                [`& .${gaugeClasses.referenceArc}`]: { fill: "none" },
                                [`& .${gaugeClasses.valueText}`]: {
                                    fontSize: "0.75rem",
                                    transform: "translate(0px, -1px)",
                                },
                            }}
                            text={`${Math.round(progressPercentage)}%`}
                            value={progressPercentage}
                            width={60}
                        />
                    </Box>
                </Box>
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
                            טנטטיבית:
                        </Typography>
                        <Typography
                            fontSize="0.8rem"
                            fontWeight="bold"
                            variant="body2"
                        >
                            {tentativeHours}
                        </Typography>
                    </Box>
                </Stack>
            </Box>
        </Box>
    );
}
