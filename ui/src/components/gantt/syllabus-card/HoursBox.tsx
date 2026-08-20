import GroupsIcon from "@mui/icons-material/Groups";
import Box, { BoxProps } from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { Gauge, gaugeClasses } from "@mui/x-charts/Gauge";
import { useMemo } from "react";

import { GanttSyllabusId } from "@/api-shared/types/gantt/models";
import {
    formatHoursLabel,
    getTentativeMinutesForModuleIds,
} from "@/components/gantt/curriculum-view/gantt-time-utils";
import { useSyllabus } from "@/components/gantt/state/hooks/UseSyllabus";
import { useGanttMappings } from "@/components/gantt/state/mappings/hooks";
import { useCurriculumState } from "@/components/gantt/state/provider";
import { useGanttRecurrenceExceptions } from "@/components/gantt/state/recurrence-exceptions/hooks";
import {
    calculateMinimumRequiredTimeForSyllabus,
    doShuffleTotalsDiffer,
    getSyllabusShuffleTotals,
} from "@/components/gantt/utils";

/**
 * Badge indicating whether all shuffles of the syllabus receive the same
 * amount of required time; a warning color marks unequal shuffles.
 */
function ShuffleTimeBadge({
    totals,
}: {
    totals: Record<string, number>;
}) {
    const differ = doShuffleTotalsDiffer(totals);
    const tooltip = (
        <Stack spacing={0}>
            <Typography variant="caption">
                {differ
                    ? "לשאפלים זמן נדרש שונה:"
                    : "לכל השאפלים זמן נדרש זהה:"}
            </Typography>
            {Object.entries(totals).map(([name, minutes]) => (
                <Typography key={name} variant="caption">
                    {name}: {formatHoursLabel(minutes)}
                </Typography>
            ))}
        </Stack>
    );

    return (
        <Tooltip title={tooltip}>
            <Chip
                color={differ ? "warning" : "default"}
                icon={<GroupsIcon />}
                label={differ ? "שאפלים לא שווים" : "שאפלים שווים"}
                size="small"
                variant="outlined"
            />
        </Tooltip>
    );
}

export type HoursBoxProps = {
    syllabusId: GanttSyllabusId;
} & BoxProps;

export function HoursBox({ syllabusId, ...props }: HoursBoxProps) {
    const state = useCurriculumState();
    const syllabus = useSyllabus(syllabusId);
    const { state: mappingState } = useGanttMappings();
    const mappings = mappingState.mappings;
    const { state: exceptionState } = useGanttRecurrenceExceptions();

    const minimumRequiredHours = useMemo(() => {
        if (!syllabus) return 0;
        const curriculumId = state.syllabuses[syllabusId]?.curriculumId;
        const curriculum = curriculumId
            ? state.curriculums[curriculumId]
            : undefined;
        const linearDays =
            curriculum?.weeks.flatMap(
                (weekId) => state.weeks[weekId]?.days ?? [],
            ) ?? [];
        return calculateMinimumRequiredTimeForSyllabus(syllabus, state, {
            mappings,
            exceptions: exceptionState.exceptions,
            linearDays,
        });
    }, [syllabus, syllabusId, state, mappings, exceptionState.exceptions]);

    const shuffleTotals = useMemo(
        () =>
            syllabus
                ? getSyllabusShuffleTotals(syllabus, "minimumDuration", state)
                : null,
        [syllabus, state],
    );

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
                    {shuffleTotals ? <Box pt={0.5}>
                        <ShuffleTimeBadge totals={shuffleTotals} />
                    </Box> : null}
                </Stack>
            </Box>
        </Box>
    );
}
