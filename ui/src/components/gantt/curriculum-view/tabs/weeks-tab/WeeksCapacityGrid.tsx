import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import {
    Box,
    Chip,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TextField,
    Tooltip,
    Typography,
    Switch,
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
  isCompact?: boolean;
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
    isCompact = false,
    mappings,
    startDate,
    state,
    week,
    weekIndex,
}: {
  isCompact?: boolean;
  mappings: Record<string, GanttCurriculumModuleDayMapping>;
  startDate: null | string;
  state: NormalizedStore;
  week: NormalizedStore["weeks"][string];
  weekIndex: number;
}) {
    const { enqueueSnackbar } = useSnackbar();
    const { updateWeek } = useWeekActions();
    const [localComment, setLocalComment] = useState(week.comment ?? "");
    const [isCommentFocused, setIsCommentFocused] = useState(false);

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
            if (event.key !== "Enter" || !event.ctrlKey) return;
            event.preventDefault();
            commitComment();
            event.currentTarget.blur();
        },
        [commitComment],
    );



    return (
        <TableRow hover>
            <TableCell
                sx={{
                    position: "sticky",
                    insetInlineStart: 0,
                    zIndex: 3,
                    bgcolor: "background.paper",
                    borderInlineEnd: "1px solid",
                    borderColor: "divider",
                    verticalAlign: "top",
                    pt: isCompact ? 0.35 : 1.25,
                    pb: isCompact ? 0.15 : 0.75,
                    px: 1.25,
                }}
            >
                <Typography fontWeight={800} sx={{ fontSize: "0.88rem", color: "text.primary" }} variant="subtitle2">
          שבוע {weekIndex + 1}
                </Typography>
                <Typography color="text.secondary" sx={{ fontSize: "0.72rem" }} variant="caption">
                    {formatWeekDateRange(weekDateRange) || "ללא תאריך"}
                </Typography>
                <Box mt={0.75}>
                    <Chip
                        color={
                            weekStatus === "error"
                                ? "error"
                                : weekStatus === "warning"
                                    ? "warning"
                                    : "primary"
                        }
                        label={`${formatHoursLabel(scheduledMinutes)} / ${formatHoursLabel(weekTotalMinutes)}`}
                        size="smaller"
                        sx={{ fontWeight: 700 }}
                        variant="outlined"
                    />
                </Box>
            </TableCell>
            <TableCell sx={{ verticalAlign: "top", pt: isCompact ? 0.35 : 1.25, pb: isCompact ? 0.15 : 0.75, px: isCompact ? 0.5 : 1.25 }}>
                <TextField
                    fullWidth
                    minRows={2}
                    multiline
                    onBlur={() => {
                        commitComment();
                        setIsCommentFocused(false);
                    }}
                    onChange={(event) => setLocalComment(event.target.value)}
                    onFocus={() => setIsCommentFocused(true)}
                    onKeyDown={handleCommentKeyDown}
                    placeholder="שם / הערת שבוע..."
                    size="small"
                    slotProps={{
                        input: {
                            style: {
                                fontSize: "0.82rem",
                                fontWeight: 500,
                            }
                        }
                    }}
                    sx={{
                        "& .MuiOutlinedInput-root": {
                            transition: "all 0.2s ease",
                            bgcolor: isCommentFocused ? "background.default" : "transparent",
                        },
                        "& .MuiOutlinedInput-notchedOutline": {
                            borderColor: isCommentFocused ? "primary.main" : "transparent",
                        },
                        "&:hover .MuiOutlinedInput-notchedOutline": {
                            borderColor: isCommentFocused ? "primary.main" : "divider",
                        },
                    }}
                    value={localComment}
                />
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
                        isCompact={isCompact}
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
    isCompact = false,
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
            className="animate-slide-up-fade"
            sx={{
                flex: 1,
                border: "1px solid",
                borderColor: "divider",
                borderRadius: "16px",
                overflowX: "hidden",
                overflowY: "auto",
                bgcolor: "background.paper",
                boxShadow: "0 4px 24px rgba(0, 0, 0, 0.03)",
                clipPath: "inset(0 round 16px)",
            }}
        >
            <Table size="small" stickyHeader sx={{ width: "100%", tableLayout: "fixed" }}>
                <TableHead>
                    <TableRow>
                        <TableCell
                            sx={{
                                position: "sticky",
                                insetInlineStart: 0,
                                zIndex: 5,
                                width: "8%",
                                minWidth: "80px",
                                bgcolor: (theme) =>
                                    theme.palette.mode === "light"
                                        ? "rgb(244, 250, 252)"
                                        : "rgb(12, 34, 55)",
                                borderInlineEnd: "1px solid",
                                borderColor: "divider",
                                fontWeight: 800,
                                py: 1.5,
                                fontSize: "0.85rem",
                            }}
                        >
              שבוע
                        </TableCell>
                        <TableCell 
                            sx={{ 
                                width: "11%",
                                minWidth: "100px",
                                bgcolor: (theme) =>
                                    theme.palette.mode === "light"
                                        ? "rgb(244, 250, 252)"
                                        : "rgb(12, 34, 55)",
                                fontWeight: 800,
                                py: 1.5,
                                fontSize: "0.85rem",
                            }}
                        >
                            שם / הערת שבוע
                        </TableCell>

                        {DAY_COLUMNS.map((dayIndex) => (
                            <TableCell 
                                align="center" 
                                key={dayIndex} 
                                sx={{ 
                                    width: "9.7%",
                                    minWidth: "90px",
                                    bgcolor: (theme) =>
                                        theme.palette.mode === "light"
                                            ? "rgba(244, 250, 252, 0.95)"
                                            : "rgba(12, 34, 55, 0.95)",
                                    fontWeight: 800,
                                    py: 1.5,
                                    fontSize: "0.85rem",
                                }}
                            >
                                {getDayNameDisplay(dayIndex)}
                            </TableCell>
                        ))}
                    </TableRow>
                </TableHead>
                <TableBody>
                    {weeks.length > 0 ? (
                        weeks.map((week, weekIndex) => (
                            <WeekRow
                                isCompact={isCompact}
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
