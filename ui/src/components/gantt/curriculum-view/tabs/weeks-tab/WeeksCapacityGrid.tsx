import EventAvailableIcon from "@mui/icons-material/EventAvailable";
import EventBusyIcon from "@mui/icons-material/EventBusy";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import {
    Box,
    Chip,
    FormControlLabel,
    Switch,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TextField,
    Tooltip,
    Typography,
} from "@mui/material";
import { useSnackbar } from "notistack";
import { KeyboardEvent, useCallback, useMemo, useState } from "react";

import { enqueueApiErrorSnackbar } from "@/api-client/common";
import { NormalizedStore } from "@/api-client/gantt/drizzle-normalize";
import {
    GanttCurriculum,
    GanttCurriculumModuleDayMapping,
    GanttDayId,
    GanttDayIndex,
    GanttWeek,
    getDayNameDisplay,
} from "@/api-shared/types/gantt/models";
import {
    formatHoursLabel,
    formatWeekDateRange,
    getCapacityStatus,
    getDayDate,
    getSaturdayForWeek,
    getScheduledMinutesForDay,
    getWeekDateRange,
    getWeekScheduledMinutes,
    getWeekTotalMinutes,
} from "@/components/gantt/curriculum-view/gantt-time-utils";
import { DayCapacityCell } from "@/components/gantt/curriculum-view/tabs/weeks-tab/DayCapacityCell";
import { useWeekActions } from "@/components/gantt/state/hooks/gantt-funcs/UseWeekActions";

export type WeeksCapacityGridProps = {
  curriculum: GanttCurriculum;
  mappings: Record<string, GanttCurriculumModuleDayMapping>;
  state: NormalizedStore;
};

const DAY_COLUMNS: Array<GanttDayIndex> = [
    GanttDayIndex.Sunday,
    GanttDayIndex.Monday,
    GanttDayIndex.Tuesday,
    GanttDayIndex.Wednesday,
    GanttDayIndex.Thursday,
    GanttDayIndex.Friday,
    GanttDayIndex.Saturday,
];

function getDayIdByIndex(
    week: GanttWeek,
    state: NormalizedStore,
    dayIndex: GanttDayIndex,
): GanttDayId | undefined {
    return week.days.find((dayId) => state.days[dayId]?.dayIndex === dayIndex);
}

function WeekRow({
    mappings,
    startDate,
    state,
    week,
    weekIndex,
}: {
  mappings: Record<string, GanttCurriculumModuleDayMapping>;
  startDate: null | string;
  state: NormalizedStore;
  week: NormalizedStore["weeks"][string];
  weekIndex: number;
}) {
    const { enqueueSnackbar } = useSnackbar();
    const { updateWeek } = useWeekActions();
    const [localComment, setLocalComment] = useState(week.comment ?? "");

    const weekTotalMinutes = useMemo(
        () => getWeekTotalMinutes(week, state),
        [state, week],
    );
    const scheduledMinutes = useMemo(
        () => getWeekScheduledMinutes({ week, mappings, state }),
        [mappings, state, week],
    );
    const weekStatus = getCapacityStatus(weekTotalMinutes, scheduledMinutes);
    const saturday = getSaturdayForWeek(week, state);
    const saturdayMismatch =
    !week.weekendDuty && (saturday?.totalWorkingMinutes ?? 0) > 0;
    const weekDateRange = getWeekDateRange(startDate, weekIndex);

    const commitComment = useCallback(() => {
        if (localComment === (week.comment ?? "")) return;

        void updateWeek(week.id, { comment: localComment }).catch((error) =>
            enqueueApiErrorSnackbar(enqueueSnackbar, "שמירת הערת שבוע נכשלה!", error),
        );
    }, [enqueueSnackbar, localComment, updateWeek, week.comment, week.id]);

    const handleCommentKeyDown = useCallback(
        (event: KeyboardEvent<HTMLInputElement>) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            commitComment();
            event.currentTarget.blur();
        },
        [commitComment],
    );

    const toggleWeekendDuty = useCallback(
        (checked: boolean) => {
            void updateWeek(week.id, { weekendDuty: checked }).catch((error) =>
                enqueueApiErrorSnackbar(
                    enqueueSnackbar,
                    "שמירת המידע של השבוע נכשלה!",
                    error,
                ),
            );
        },
        [enqueueSnackbar, updateWeek, week.id],
    );

    return (
        <TableRow hover>
            <TableCell
                sx={{
                    position: "sticky",
                    insetInlineStart: 0,
                    zIndex: 3,
                    minWidth: 150,
                    bgcolor: "background.paper",
                    borderInlineEnd: 1,
                    borderColor: "divider",
                    verticalAlign: "top",
                }}
            >
                <Typography fontWeight={700} variant="subtitle2">
          שבוע {week.number}
                </Typography>
                <Typography color="text.secondary" variant="caption">
                    {formatWeekDateRange(weekDateRange) || "ללא תאריך"}
                </Typography>
                <Box mt={1}>
                    <Chip
                        color={
                            weekStatus === "error"
                                ? "error"
                                : weekStatus === "warning"
                                    ? "warning"
                                    : "primary"
                        }
                        label={`${formatHoursLabel(scheduledMinutes)} / ${formatHoursLabel(weekTotalMinutes)}`}
                        size="small"
                        variant="outlined"
                    />
                </Box>
            </TableCell>
            <TableCell sx={{ minWidth: 190, verticalAlign: "top" }}>
                <TextField
                    fullWidth
                    multiline
                    onBlur={commitComment}
                    onChange={(event) => setLocalComment(event.target.value)}
                    onKeyDown={handleCommentKeyDown}
                    placeholder="שם / הערת שבוע"
                    size="small"
                    value={localComment}
                />
            </TableCell>
            <TableCell sx={{ minWidth: 154, verticalAlign: "top" }}>
                <Box display="flex" flexDirection="column" gap={1}>
                    <FormControlLabel
                        control={
                            <Switch
                                checked={week.weekendDuty}
                                onChange={(event) => toggleWeekendDuty(event.target.checked)}
                                size="small"
                            />
                        }
                        label={
                            <Box alignItems="center" display="flex" gap={0.5}>
                                {week.weekendDuty ? (
                                    <EventBusyIcon color="warning" fontSize="small" />
                                ) : (
                                    <EventAvailableIcon color="success" fontSize="small" />
                                )}
                                <Typography variant="body2">
                                    {week.weekendDuty ? "סוגרים שבת" : "יוצאים"}
                                </Typography>
                            </Box>
                        }
                        sx={{ m: 0 }}
                    />
                    {saturdayMismatch ? (
                        <Tooltip title="השבוע מסומן כיוצאים, אך לשבת הוגדרו שעות עבודה">
                            <Chip
                                color="warning"
                                icon={<WarningAmberIcon />}
                                label="שבת עם שעות"
                                size="small"
                                variant="outlined"
                            />
                        </Tooltip>
                    ) : null}
                </Box>
            </TableCell>
            {DAY_COLUMNS.map((dayIndex) => {
                const dayId = getDayIdByIndex(week, state, dayIndex);

                if (!dayId) {
                    return <TableCell key={dayIndex} sx={{ minWidth: 160 }} />;
                }

                const dayDate = getDayDate(startDate, weekIndex, dayIndex);
                const day = state.days[dayId];
                const isMutedSaturday =
          dayIndex === GanttDayIndex.Saturday && !week.weekendDuty;

                return (
                    <DayCapacityCell
                        dayId={dayId}
                        isMuted={isMutedSaturday}
                        key={`${week.id}-${dayIndex}-${day?.totalWorkingMinutes ?? 0}-${day?.comment ?? ""}-${dayDate?.format("YYYY-MM-DD") ?? ""}`}
                        scheduledMinutes={getScheduledMinutesForDay({
                            dayId,
                            mappings,
                            state,
                        })}
                        startDate={startDate}
                        weekIndex={weekIndex}
                    />
                );
            })}
        </TableRow>
    );
}

export function WeeksCapacityGrid({
    curriculum,
    mappings,
    state,
}: WeeksCapacityGridProps) {
    const weeks = useMemo(
        () => {
            const nextWeeks: Array<NormalizedStore["weeks"][string]> = [];

            for (const weekId of curriculum.weeks) {
                const week = state.weeks[weekId];
                if (week) {
                    nextWeeks.push(week);
                }
            }

            return nextWeeks;
        },
        [curriculum.weeks, state.weeks],
    );

    return (
        <TableContainer
            sx={{
                flex: 1,
                border: 1,
                borderColor: "divider",
                borderRadius: 1,
                overflow: "auto",
                bgcolor: "background.paper",
            }}
        >
            <Table size="small" stickyHeader sx={{ minWidth: 1500 }}>
                <TableHead>
                    <TableRow>
                        <TableCell
                            sx={{
                                position: "sticky",
                                insetInlineStart: 0,
                                zIndex: 5,
                                minWidth: 150,
                                bgcolor: "background.paper",
                                borderInlineEnd: 1,
                                borderColor: "divider",
                            }}
                        >
              שבוע
                        </TableCell>
                        <TableCell sx={{ minWidth: 190 }}>שם / הערת שבוע</TableCell>
                        <TableCell sx={{ minWidth: 154 }}>שבת בבסיס</TableCell>
                        {DAY_COLUMNS.map((dayIndex) => (
                            <TableCell align="center" key={dayIndex} sx={{ minWidth: 160 }}>
                                {getDayNameDisplay(dayIndex)}
                            </TableCell>
                        ))}
                    </TableRow>
                </TableHead>
                <TableBody>
                    {weeks.length > 0 ? (
                        weeks.map((week, weekIndex) => (
                            <WeekRow
                                key={`${week.id}-${week.comment ?? ""}-${week.weekendDuty}`}
                                mappings={mappings}
                                startDate={curriculum.startDate}
                                state={state}
                                week={week}
                                weekIndex={weekIndex}
                            />
                        ))
                    ) : (
                        <TableRow>
                            <TableCell align="center" colSpan={10} sx={{ py: 5 }}>
                                <Typography color="text.secondary">
                  אין עדיין שבועות בגאנט. הוסיפו שבוע דרך ניהול אורך קורס.
                                </Typography>
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </TableContainer>
    );
}
