import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import { useTheme } from "@mui/material/styles";
import Typography from "@mui/material/Typography";
import { Gauge, gaugeClasses } from "@mui/x-charts/Gauge";
import { useMemo } from "react";

import { GanttCurriculumDocument } from "@/api-client/gantt/curriculum";
import { useCourses } from "@/components/base/CoursesProvider";
import { formatHoursLabel } from "@/components/gantt/curriculum-view/gantt-time-utils";
import { calculateStudentTentativeMinutes } from "@/components/gantt/curriculum-view/student-load";
import { useHoursFormat } from "@/components/gantt/curriculum-view/use-hours-format";
import { useCurriculumStudentSchedule } from "@/components/gantt/curriculum-view/use-student-schedule";
import { useCurriculumState } from "@/components/gantt/state/context";
import { useGanttMappings } from "@/components/gantt/state/mappings/hooks";

export function HoursCard({
    curriculum,
}: {
    curriculum: GanttCurriculumDocument | undefined;
})
{
    const theme = useTheme();
    const state = useCurriculumState();
    const { state: mappingState } = useGanttMappings();
    const mappings = mappingState.mappings;
    const { courses } = useCourses();
    // Re-render when the viewer switches decimal/clock hours (#813).
    useHoursFormat();

    const totalWorkingHours = useMemo(() =>
    {
        return (curriculum?.weeks ?? []).reduce((total: number, weekId) =>
        {
            const week = state.weeks[ weekId ];
            if (!week) return total;
            return (
                total +
                (week.days ?? []).reduce((weekTotal: number, dayId) =>
                {
                    const day = state.days[ dayId ];
                    return weekTotal + (day?.totalWorkingMinutes ?? 0) / 60;
                }, 0)
            );
        }, 0);
    }, [ curriculum?.weeks, state.weeks, state.days ]);

    // One student's time: parallel shuffles and course paths count once.
    const schedule = useCurriculumStudentSchedule(curriculum, state);
    const minimumHoursRequired = schedule.requiredMinutes / 60;
    const usedWorkingHours = schedule.scheduledMinutes / 60;
    const tentativeWorkingHours = useMemo(
        () =>
            curriculum
                ? calculateStudentTentativeMinutes({
                    courses,
                    mappings,
                    moduleIds: curriculum.syllabuses.flatMap(
                        (syllabusId) => state.syllabuses[ syllabusId ]?.modules ?? [],
                    ),
                    state,
                }) / 60
                : 0,
        [ curriculum, mappings, state, courses ],
    );

    if (!curriculum)
    {
        return (
            <Card
                sx={ {
                    padding: 2,
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    minHeight: 150,
                } }
            >
                <CircularProgress />
            </Card>
        );
    }

    return (
        <Card sx={ { padding: 2, flexShrink: 0 } }>
            <Typography gutterBottom variant="subtitle1">
                שעות
            </Typography>
            <Box alignItems="center" display="flex" flexDirection="row" gap={ 3 }>
                <Box sx={ { position: "relative", height: 80, width: 80 } }>
                    <Box sx={ { position: "absolute", insetInlineStart: 0, top: 0 } }>
                        <Gauge
                            height={ 80 }
                            sx={ {
                                [ `& .${gaugeClasses.valueArc}` ]: {
                                    fill: theme.palette.primary.main,
                                    opacity: 0.35,
                                },
                                [ `& .${gaugeClasses.referenceArc}` ]: {
                                    fill: "grey.200",
                                },
                                [ `& .${gaugeClasses.valueText}` ]: { display: "none" },
                            } }
                            value={ tentativeWorkingHours }
                            valueMax={ totalWorkingHours }
                            valueMin={ 0 }
                            width={ 80 }
                        />
                    </Box>
                    <Box sx={ { position: "absolute", insetInlineStart: 0, top: 0 } }>
                        <Gauge
                            height={ 80 }
                            sx={ {
                                [ `& .${gaugeClasses.valueText}` ]: {
                                    fontSize: "1rem",
                                    fontWeight: "medium",
                                    transform: "translate(0px, -1px)",
                                },
                                [ `& .${gaugeClasses.valueArc}` ]: {
                                    fill:
                                        totalWorkingHours === 0
                                            ? "grey.200"
                                            : totalWorkingHours >= usedWorkingHours
                                                ? theme.palette.primary.main
                                                : theme.palette.warning.main,
                                },
                                [ `& .${gaugeClasses.referenceArc}` ]: {
                                    fill: "none",
                                },
                            } }
                            text={
                                totalWorkingHours > 0
                                    ? `${Math.round((100 * usedWorkingHours) / totalWorkingHours)}%`
                                    : "-"
                            }
                            value={ usedWorkingHours }
                            valueMax={ totalWorkingHours }
                            valueMin={ 0 }
                            width={ 80 }
                        />
                    </Box>
                </Box>
                <Stack spacing={ 0.5 }>
                    <Box
                        alignItems="baseline"
                        display="flex"
                        flexDirection="row"
                        gap={ 1 }
                    >
                        <Typography color="text.secondary" variant="body2">
                            ס&quot;ך:
                        </Typography>
                        <Typography fontWeight="bold" variant="body2">
                            { formatHoursLabel(totalWorkingHours * 60) }
                        </Typography>
                    </Box>
                    <Box
                        alignItems="baseline"
                        display="flex"
                        flexDirection="row"
                        gap={ 1 }
                    >
                        <Typography color="text.secondary" variant="body2">
                            שובצו:
                        </Typography>
                        <Typography fontWeight="bold" variant="body2">
                            { formatHoursLabel(usedWorkingHours * 60) }
                        </Typography>
                    </Box>
                    <Box
                        alignItems="baseline"
                        display="flex"
                        flexDirection="row"
                        gap={ 1 }
                    >
                        <Typography color="text.secondary" variant="body2">
                            מינימום דרוש:
                        </Typography>
                        <Typography fontWeight="bold" variant="body2">
                            { formatHoursLabel(minimumHoursRequired * 60) }
                        </Typography>
                    </Box>
                    <Box
                        alignItems="baseline"
                        display="flex"
                        flexDirection="row"
                        gap={ 1 }
                    >
                        <Typography color="text.secondary" variant="body2">
                            טנטטיבית:
                        </Typography>
                        <Typography fontWeight="bold" variant="body2">
                            { formatHoursLabel(tentativeWorkingHours * 60) }
                        </Typography>
                    </Box>
                </Stack>
            </Box>
        </Card>
    );
}
