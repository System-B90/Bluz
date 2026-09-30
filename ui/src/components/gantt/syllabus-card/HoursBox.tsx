import Box, { BoxProps } from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { Gauge, gaugeClasses } from "@mui/x-charts/Gauge";
import { useMemo } from "react";

import { GanttSyllabusId } from "@/api-shared/types/gantt/models";
import { useCourses } from "@/components/base/CoursesProvider";
import { formatMinutesAsDuration } from "@/components/gantt/curriculum-view/gantt-time-utils";
import {
    calculateStudentMinutes,
    calculateStudentSyllabusMinutes,
    calculateStudentTentativeMinutes,
} from "@/components/gantt/curriculum-view/student-load";
import { useCurriculumState } from "@/components/gantt/state/context";
import { useSyllabus } from "@/components/gantt/state/hooks/UseSyllabus";
import { useGanttMappings } from "@/components/gantt/state/mappings/hooks";
import { useGanttRecurrenceExceptions } from "@/components/gantt/state/recurrence-exceptions/hooks";

export type HoursBoxProps = {
    syllabusId: GanttSyllabusId;
} & BoxProps;

export function HoursBox({ syllabusId, ...props }: HoursBoxProps) {
    const state = useCurriculumState();
    const syllabus = useSyllabus(syllabusId);
    const { state: mappingState } = useGanttMappings();
    const mappings = mappingState.mappings;
    const { state: exceptionState } = useGanttRecurrenceExceptions();
    const { courses } = useCourses();

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
        return calculateStudentSyllabusMinutes(syllabus.id, state, courses, {
            mappings,
            exceptions: exceptionState.exceptions,
            linearDays,
        });
    }, [syllabus, syllabusId, state, courses, mappings, exceptionState.exceptions]);

    const tentativeHours = useMemo(() => {
        if (!syllabus || !mappings) return 0;
        return calculateStudentTentativeMinutes({
            courses,
            mappings,
            moduleIds: syllabus.modules,
            state,
        });
    }, [syllabus, mappings, state, courses]);

    const scheduledHours = useMemo(() => {
        if (!syllabus || !mappings) return 0;
        const moduleIdsSet = new Set(syllabus.modules);
        // Allocated time only comes from allocated events, never a whole
        // module, and counts one student's time: parallel shuffles and
        // exclusive courses once (#699).
        const placed = new Set<string>();
        for (const mapping of Object.values(mappings)) {
            if (moduleIdsSet.has(mapping.moduleId) && mapping.eventId) {
                placed.add(mapping.eventId);
            }
        }
        return calculateStudentMinutes({
            courses,
            include: (eventId) => placed.has(eventId),
            state,
            syllabusIds: [syllabus.id],
        });
    }, [syllabus, mappings, state, courses]);

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
                            {formatMinutesAsDuration(scheduledHours)}
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
                            {formatMinutesAsDuration(minimumRequiredHours)}
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
                            {formatMinutesAsDuration(tentativeHours)}
                        </Typography>
                    </Box>
                </Stack>
            </Box>
        </Box>
    );
}
