import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useSnackbar } from "notistack";
import { KeyboardEvent, useCallback, useEffect, useMemo, useState } from "react";

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
    computeEventDaySpans,
    formatHoursLabel,
    formatWeekDateRange,
    getCapacityStatus,
    getSpilloverMinutesByDay,
    getWeekDateRange,
    getWeekScheduledMinutes,
    getWeekTotalMinutes,
} from "@/components/gantt/curriculum-view/gantt-time-utils";
import { BulkDayHoursBar } from "@/components/gantt/curriculum-view/tabs/weeks-tab/BulkDayHoursBar";
import { DayCapacityCell } from "@/components/gantt/curriculum-view/tabs/weeks-tab/DayCapacityCell";
import { DaySelectionProvider } from "@/components/gantt/curriculum-view/tabs/weeks-tab/DaySelectionContext";
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
    scheduledMinutesByDay,
    startDate,
    state,
    week,
    weekIndex,
}: {
    isCompact?: boolean;
    mappings: Record<string, GanttCurriculumModuleDayMapping>;
    /** Per-day scheduled minutes with multi-day spillover applied (#105). */
    scheduledMinutesByDay: Record<GanttDayId, number>;
    startDate: null | string;
    state: NormalizedStore;
    week: NormalizedStore["weeks"][string];
    weekIndex: number;
}) {
    const { enqueueSnackbar } = useSnackbar();
    const { updateWeek } = useWeekActions();
    const [localComment, setLocalComment] = useState(week.comment ?? "");
    const [isCommentFocused, setIsCommentFocused] = useState(false);

    // Reconcile local editable comment with the server value when it changes
    // externally (another user's edit, or our own commit round-tripping back),
    // but never while the field is focused so in-progress typing is preserved
    // (#165 — same pattern as DayCapacityCell / DayHeaderCell #164).
    useEffect(() => {
        if (!isCommentFocused) {
            // eslint-disable-next-line react-hooks/set-state-in-effect -- Syncing local editable state to an external (server) value change, not derived render state.
            setLocalComment(week.comment ?? "");
        }
    }, [week.comment, isCommentFocused]);

    const weekTotalMinutes = useMemo(
        () => getWeekTotalMinutes(week, state),
        [state, week],
    );
    const scheduledMinutes = useMemo(
        () => getWeekScheduledMinutes({ week, mappings, state }),
        [mappings, state, week],
    );
    const weekStatus = getCapacityStatus(weekTotalMinutes, scheduledMinutes);
    const weekDateRange = getWeekDateRange(startDate, weekIndex);

    const commitComment = useCallback(() => {
        if (localComment === (week.comment ?? "")) return;

        void updateWeek(week.id, { comment: localComment }).catch((error) =>
            enqueueApiErrorSnackbar(
                enqueueSnackbar,
                "שמירת הערת שבוע נכשלה!",
                error,
            ),
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
                <Typography
                    fontWeight={800}
                    sx={{ fontSize: "0.88rem", color: "text.primary" }}
                    variant="subtitle2"
                >
                    שבוע {weekIndex + 1}
                </Typography>
                <Typography
                    color="text.secondary"
                    sx={{ fontSize: "0.72rem" }}
                    variant="caption"
                >
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
            <TableCell
                sx={{
                    verticalAlign: "top",
                    pt: isCompact ? 0.35 : 1.25,
                    pb: isCompact ? 0.15 : 0.75,
                    px: isCompact ? 0.5 : 1.25,
                }}
            >
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
                            },
                        },
                    }}
                    sx={{
                        "& .MuiOutlinedInput-root": {
                            transition: "all 0.2s ease",
                            bgcolor: isCommentFocused
                                ? "background.default"
                                : "transparent",
                        },
                        "& .MuiOutlinedInput-notchedOutline": {
                            borderColor: isCommentFocused
                                ? "primary.main"
                                : "transparent",
                        },
                        "&:hover .MuiOutlinedInput-notchedOutline": {
                            borderColor: isCommentFocused
                                ? "primary.main"
                                : "divider",
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

                const isMutedSaturday =
                    dayIndex === GanttDayIndex.Saturday && !week.weekendDuty;

                return (
                    <DayCapacityCell
                        dayId={dayId}
                        isCompact={isCompact}
                        isMuted={isMutedSaturday}
                        key={dayId}
                        scheduledMinutes={scheduledMinutesByDay[dayId] ?? 0}
                        startDate={startDate}
                        weekIndex={weekIndex}
                    />
                );
            })}
        </TableRow>
    );
}

/**
 * Just the weekday's name. The column used to carry an hours field that wrote
 * that weekday across every week at once; shift-selecting the actual cells
 * covers that and every range it could not express (#476).
 */
function DayHeaderCell({ dayIndex }: { dayIndex: GanttDayIndex }) {
    return (
        <TableCell
            align="center"
            sx={{
                width: "9.7%",
                minWidth: "90px",
                bgcolor: "background.default",
                fontWeight: 800,
                py: 1.5,
                fontSize: "0.85rem",
            }}
        >
            <Typography
                sx={{ fontWeight: 800, fontSize: "0.85rem" }}
                variant="subtitle2"
            >
                {getDayNameDisplay(dayIndex)}
            </Typography>
        </TableCell>
    );
}

export function WeeksCapacityGrid({
    curriculum,
    isCompact = false,
    mappings,
    state,
}: WeeksCapacityGridProps) {
    const weeks = useMemo(() => {
        const nextWeeks: Array<NormalizedStore["weeks"][string]> = [];

        for (const weekId of curriculum.weeks) {
            const week = state.weeks[weekId];
            if (week) {
                nextWeeks.push(week);
            }
        }

        return nextWeeks;
    }, [curriculum.weeks, state.weeks]);

    // Multi-day spillover: distribute each event's minutes across the days it
    // actually occupies so capacity bars reflect the dynamic overflow (#105).
    const scheduledMinutesByDay = useMemo(() => {
        const linearDays = weeks.flatMap((week) => week.days);
        return getSpilloverMinutesByDay(
            computeEventDaySpans({ mappings, state, linearDays }),
        );
    }, [weeks, mappings, state]);

    // Calendar order of every rendered day — the order a shift-selected range
    // is defined over (#476). Week order comes from the curriculum; within a
    // week the grid's own column order decides, not the stored day order.
    const orderedDayIds = useMemo(
        () =>
            weeks.flatMap((week) =>
                DAY_COLUMNS.map((dayIndex) =>
                    getDayIdByIndex(week, state, dayIndex),
                ).filter((dayId): dayId is GanttDayId => Boolean(dayId)),
            ),
        [state, weeks],
    );

    return (
        <DaySelectionProvider orderedDayIds={orderedDayIds}>
            <TableContainer
                className="animate-slide-up-fade"
                sx={{
                // The tab itself is the scroll container now (#477), so the
                // grid must grow instead of scrolling inside it — two nested
                // scrollers would leave the summary card pinned after all.
                    flex: "0 0 auto",
                    border: "1px solid",
                    borderColor: "divider",
                    borderRadius: "16px",
                    overflowX: "hidden",
                    overflowY: "visible",
                    bgcolor: "background.paper",
                    boxShadow: "0 4px 24px rgba(0, 0, 0, 0.03)",
                    clipPath: "inset(0 round 16px)",
                }}
            >
                <Table
                    size="small"
                    stickyHeader
                    sx={{ width: "100%", tableLayout: "fixed" }}
                >
                    <TableHead>
                        <TableRow>
                            <TableCell
                                sx={{
                                    position: "sticky",
                                    insetInlineStart: 0,
                                    zIndex: 5,
                                    width: "8%",
                                    minWidth: "80px",
                                    bgcolor: "background.default",
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
                                    bgcolor: "background.default",
                                    fontWeight: 800,
                                    py: 1.5,
                                    fontSize: "0.85rem",
                                }}
                            >
                            שם / הערת שבוע
                            </TableCell>

                            {DAY_COLUMNS.map((dayIndex) => (
                                <DayHeaderCell dayIndex={dayIndex} key={dayIndex} />
                            ))}
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {weeks.length > 0 ? (
                            weeks.map((week, weekIndex) => (
                                <WeekRow
                                    isCompact={isCompact}
                                    key={week.id}
                                    mappings={mappings}
                                    scheduledMinutesByDay={scheduledMinutesByDay}
                                    startDate={curriculum.startDate}
                                    state={state}
                                    week={week}
                                    weekIndex={weekIndex}
                                />
                            ))
                        ) : (
                            <TableRow>
                                <TableCell
                                    align="center"
                                    colSpan={10}
                                    sx={{ py: 5 }}
                                >
                                    <Typography color="text.secondary">
                                    אין עדיין שבועות בגאנט. הוסיפו שבוע דרך
                                    ניהול אורך קורס.
                                    </Typography>
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
                <BulkDayHoursBar />
            </TableContainer>
        </DaySelectionProvider>
    );
}
