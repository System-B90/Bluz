import AddIcon from "@mui/icons-material/Add";
import EventAvailableIcon from "@mui/icons-material/EventAvailable";
import RemoveIcon from "@mui/icons-material/Remove";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import { alpha, useTheme } from "@mui/material/styles";
import Switch from "@mui/material/Switch";
import TableCell from "@mui/material/TableCell";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useSnackbar } from "notistack";
import { KeyboardEvent, useCallback, useEffect, useMemo, useState } from "react";

import { enqueueApiErrorSnackbar } from "@/api-client/common";
import
{
    GanttDayId,
    GanttDayIndex,
    getDayNameDisplay,
} from "@/api-shared/types/gantt/models";
import
{
    CapacityStatus,
    formatHoursLabel,
    formatMinutesAsTimeInput,
    formatShortDate,
    getCapacityStatus,
    getDayDate,
    parseTimeInputToMinutes,
} from "@/components/gantt/curriculum-view/gantt-time-utils";
import { useWeekActions } from "@/components/gantt/state/hooks/gantt-funcs/UseWeekActions";
import { useCurriculumDay } from "@/components/gantt/state/hooks/UseDay";
import { useCurriculumState } from "@/components/gantt/state/provider";

export type DayCapacityCellProps = {
    dayId: GanttDayId;
    isCompact?: boolean;
    isMuted?: boolean;
    scheduledMinutes: number;
    startDate: null | string;
    weekIndex: number;
};

function getStatusColor(
    status: CapacityStatus,
): "default" | "error" | "primary" | "warning" {
    if (status === "error") return "error";
    if (status === "warning") return "warning";
    if (status === "ok") return "primary";

    return "default";
}

export function DayCapacityCell({
    dayId,
    isCompact = false,
    isMuted = false,
    scheduledMinutes,
    startDate,
    weekIndex,
}: DayCapacityCellProps) {
    const theme = useTheme();
    const { enqueueSnackbar } = useSnackbar();
    const state = useCurriculumState();
    const day = useCurriculumDay(dayId);
    const { updateDay, updateWeek } = useWeekActions();
    const week = day ? state.weeks[day.weekId] : undefined;

    const toggleWeekendDuty = useCallback(
        (checked: boolean) => {
            if (!day) return;
            void updateWeek(day.weekId, { weekendDuty: checked }).catch(
                (error) =>
                    enqueueApiErrorSnackbar(
                        enqueueSnackbar,
                        "שמירת המידע של השבוע נכשלה!",
                        error,
                    ),
            );
        },
        [day, enqueueSnackbar, updateWeek],
    );

    const [localTime, setLocalTime] = useState(() =>
        formatMinutesAsTimeInput(day?.totalWorkingMinutes ?? 0),
    );
    const [localComment, setLocalComment] = useState(day?.comment ?? "");
    const [isTimeFocused, setIsTimeFocused] = useState(false);
    const [isCommentFocused, setIsCommentFocused] = useState(false);

    // Sync local state when the server value changes and the field is not focused
    useEffect(() => {
        if (!isTimeFocused) {
            // eslint-disable-next-line react-hooks/set-state-in-effect -- Sync local state from server prop when field is not focused
            setLocalTime(formatMinutesAsTimeInput(day?.totalWorkingMinutes ?? 0));
        }
    }, [day?.totalWorkingMinutes, isTimeFocused]);

    useEffect(() => {
        if (!isCommentFocused) {
            // eslint-disable-next-line react-hooks/set-state-in-effect -- Sync local state from server prop when field is not focused
            setLocalComment(day?.comment ?? "");
        }
    }, [day?.comment, isCommentFocused]);

    const status = useMemo(
        () =>
            getCapacityStatus(day?.totalWorkingMinutes ?? 0, scheduledMinutes),
        [day?.totalWorkingMinutes, scheduledMinutes],
    );

    const dateLabel = useMemo(() => {
        if (!day) return "";
        const date = getDayDate(startDate, weekIndex, day.dayIndex);
        return date ? formatShortDate(date) : "";
    }, [day, startDate, weekIndex]);

    const statusLabel = useMemo(() => {
        const availableMinutes = day?.totalWorkingMinutes ?? 0;
        const remainingMinutes = availableMinutes - scheduledMinutes;

        if (scheduledMinutes === 0 && availableMinutes === 0) return "סגור";
        if (scheduledMinutes === 0) return "פנוי";
        if (remainingMinutes < 0) {
            return `חריגה ${formatHoursLabel(Math.abs(remainingMinutes))}`;
        }

        return `נותרו ${formatHoursLabel(remainingMinutes)}`;
    }, [day?.totalWorkingMinutes, scheduledMinutes]);

    const commitTime = useCallback(() => {
        if (!day) return;

        const parsedMinutes = parseTimeInputToMinutes(localTime);
        if (parsedMinutes === null) {
            setLocalTime(formatMinutesAsTimeInput(day.totalWorkingMinutes));
            return;
        }

        if (parsedMinutes === day.totalWorkingMinutes) return;

        void updateDay(dayId, { totalWorkingMinutes: parsedMinutes }).catch(
            (error) =>
                enqueueApiErrorSnackbar(
                    enqueueSnackbar,
                    "שמירת שעות נכשלה!",
                    error,
                ),
        );
    }, [day, dayId, enqueueSnackbar, localTime, updateDay]);

    const commitComment = useCallback(() => {
        if (!day || localComment === (day.comment ?? "")) return;

        void updateDay(dayId, { comment: localComment }).catch((error) =>
            enqueueApiErrorSnackbar(
                enqueueSnackbar,
                "שמירת הערת יום נכשלה!",
                error,
            ),
        );
    }, [day, dayId, enqueueSnackbar, localComment, updateDay]);

    const adjustMinutes = useCallback(
        (deltaMinutes: number) => {
            if (!day) return;

            const nextMinutes = Math.max(
                0,
                Math.min(24 * 60, day.totalWorkingMinutes + deltaMinutes),
            );
            setLocalTime(formatMinutesAsTimeInput(nextMinutes));
            void updateDay(dayId, { totalWorkingMinutes: nextMinutes }).catch(
                (error) =>
                    enqueueApiErrorSnackbar(
                        enqueueSnackbar,
                        "שמירת שעות נכשלה!",
                        error,
                    ),
            );
        },
        [day, dayId, enqueueSnackbar, updateDay],
    );

    const handleTimeKeyDown = useCallback(
        (event: KeyboardEvent<HTMLInputElement>) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            commitTime();
            event.currentTarget.blur();
        },
        [commitTime],
    );

    const backgroundColor = useMemo(() => {
        if (isMuted)
            return alpha(theme.palette.action.disabledBackground, 0.45);
        if (status === "error") return alpha(theme.palette.error.main, 0.08);
        if (status === "warning")
            return alpha(theme.palette.warning.main, 0.12);
        if (status === "ok") return alpha(theme.palette.primary.main, 0.08);

        return undefined;
    }, [isMuted, status, theme]);

    if (!day) {
        return <TableCell sx={{ minWidth: 154 }} />;
    }

    const dayName = getDayNameDisplay(day.dayIndex);
    const hasComment = Boolean(localComment);
    const isEditing = isTimeFocused || isCommentFocused;

    // Stable, consistent container height and flex settings to prevent shifting/collapsing
    const cellBoxStyles = {
        minHeight: isCompact ? 68 : 120,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
    };

    if (isMuted) {
        return (
            <TableCell
                className="day-capacity-cell"
                sx={{
                    pt: isCompact ? 0.35 : 1.25,
                    pb: isCompact ? 0.15 : 0.75,
                    px: isCompact ? 0.5 : 1.25,
                    bgcolor: backgroundColor ?? "background.paper",
                    borderInlineStart: "1px solid",
                    borderColor: "divider",
                    opacity: 0.72,
                    verticalAlign: "top",
                }}
            >
                <Box sx={cellBoxStyles}>
                    <Box
                        alignItems="center"
                        display="flex"
                        justifyContent="space-between"
                    >
                        <Typography
                            fontWeight={700}
                            sx={{
                                color: "text.secondary",
                                letterSpacing: "0.01em",
                                fontSize: "0.78rem",
                            }}
                            variant="caption"
                        >
                            {dayName}
                            {dateLabel ? ` (${dateLabel})` : ""}
                        </Typography>
                        {day?.dayIndex === GanttDayIndex.Saturday && (
                            <Tooltip
                                arrow
                                title={
                                    week?.weekendDuty ? "יציאה הביתה" : "סגירת שבת"
                                }
                            >
                                <Switch
                                    checked={week?.weekendDuty ?? false}
                                    onChange={(event) =>
                                        toggleWeekendDuty(event.target.checked)
                                    }
                                    size="small"
                                />
                            </Tooltip>
                        )}
                    </Box>

                    <Box
                        alignItems="center"
                        display="flex"
                        flexDirection="column"
                        justifyContent="center"
                        sx={{ py: 1, gap: 0.5 }}
                    >
                        <EventAvailableIcon
                            sx={{ fontSize: 18, color: "success.main" }}
                        />
                        <Typography
                            sx={{
                                fontWeight: 700,
                                color: "success.main",
                                fontSize: "0.72rem",
                                letterSpacing: "0.02em",
                            }}
                            variant="caption"
                        >
                            יוצאים הביתה
                        </Typography>
                    </Box>

                    {/* Consistent bottom spacing matching comment field height in active cells */}
                    <Box sx={{ height: 18 }} />
                </Box>
            </TableCell>
        );
    }

    return (
        <TableCell
            className="day-capacity-cell group/cell"
            sx={{
                pt: isCompact ? 0.35 : 1.25,
                pb: isCompact ? 0.15 : 0.75,
                px: isCompact ? 0.5 : 1.25,
                bgcolor: backgroundColor ?? "background.paper",
                borderInlineStart: "1px solid",
                borderColor: "divider",
                verticalAlign: "top",
                position: "relative",
                transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
                "&:hover": {
                    bgcolor: backgroundColor ? alpha(backgroundColor, 0.18) : "action.hover",
                },
            }}
        >
            <Box sx={cellBoxStyles}>
                <Box display="flex" flexDirection="column" gap={0.75}>
                    <Box
                        alignItems="center"
                        display="flex"
                        justifyContent="space-between"
                    >
                        <Typography
                            fontWeight={700}
                            sx={{
                                color: "text.primary",
                                letterSpacing: "0.01em",
                                fontSize: "0.78rem",
                            }}
                            variant="caption"
                        >
                            {dayName}
                            {dateLabel ? ` (${dateLabel})` : ""}
                        </Typography>
                        {day?.dayIndex === GanttDayIndex.Saturday && (
                            <Tooltip
                                arrow
                                title={
                                    week?.weekendDuty ? "יציאה הביתה" : "סגירת שבת"
                                }
                            >
                                <Switch
                                    checked={week?.weekendDuty ?? false}
                                    onChange={(event) =>
                                        toggleWeekendDuty(event.target.checked)
                                    }
                                    size="small"
                                />
                            </Tooltip>
                        )}
                    </Box>
                    <Box
                        alignItems="center"
                        display="grid"
                        gap={0.5}
                        gridTemplateColumns="24px 1fr 24px"
                        sx={{ position: "relative" }}
                    >
                        <IconButton
                            className="cell-control-btn"
                            onClick={() => adjustMinutes(-60)}
                            size="small"
                            sx={{
                                opacity: isEditing ? 1 : 0,
                                transform: isEditing
                                    ? "scale(1)"
                                    : "scale(0.8)",
                                transition:
                                    "all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)",
                                ".group\\/cell:hover &": {
                                    opacity: 1,
                                    transform: "scale(1)",
                                },
                            }}
                        >
                            <RemoveIcon fontSize="inherit" />
                        </IconButton>
                        <TextField
                            onBlur={() => {
                                commitTime();
                                setIsTimeFocused(false);
                            }}
                            onChange={(event) =>
                                setLocalTime(event.target.value)
                            }
                            onFocus={() => setIsTimeFocused(true)}
                            onKeyDown={handleTimeKeyDown}
                            size="small"
                            slotProps={{
                                htmlInput: {
                                    inputMode: "numeric",
                                    style: {
                                        fontFamily: "monospace",
                                        textAlign: "center",
                                        fontWeight: 700,
                                        fontSize: isCompact ? "0.75rem" : "0.85rem",
                                        padding: isCompact ? "0px 4px" : "4px 8px",
                                    },
                                },
                            }}
                            sx={{
                                "& .MuiOutlinedInput-root": {
                                    transition: "all 0.2s ease",
                                    bgcolor: isEditing
                                        ? "background.default"
                                        : "transparent",
                                },
                                "& .MuiOutlinedInput-notchedOutline": {
                                    borderColor: isEditing
                                        ? "primary.main"
                                        : "transparent",
                                },
                                "&:hover .MuiOutlinedInput-notchedOutline": {
                                    borderColor: isEditing
                                        ? "primary.main"
                                        : "divider",
                                },
                            }}
                            value={localTime}
                        />
                        <IconButton
                            className="cell-control-btn"
                            onClick={() => adjustMinutes(60)}
                            size="small"
                            sx={{
                                opacity: isEditing ? 1 : 0,
                                transform: isEditing
                                    ? "scale(1)"
                                    : "scale(0.8)",
                                transition:
                                    "all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)",
                                ".group\\/cell:hover &": {
                                    opacity: 1,
                                    transform: "scale(1)",
                                },
                            }}
                        >
                            <AddIcon fontSize="inherit" />
                        </IconButton>
                    </Box>
                    <Chip
                        color={getStatusColor(status)}
                        label={`${formatHoursLabel(scheduledMinutes)} משובץ | ${statusLabel}`}
                        size="smaller"
                        sx={{
                            maxWidth: "100%",
                            fontWeight: 600,
                            borderWidth: 1,
                            bgcolor: "background.paper",
                            transition: "all 0.2s ease",
                            "& .MuiChip-label": { px: 1 },
                        }}
                        variant="outlined"
                    />
                </Box>

                <Box
                    sx={{
                        minHeight: 18,
                        display: "flex",
                        flexDirection: "column",
                        position: "relative",
                        mt: 0.5,
                    }}
                >
                    {hasComment && !isCommentFocused ? (
                        <Typography
                            onClick={() => setIsCommentFocused(true)}
                            sx={{
                                color: "text.secondary",
                                fontStyle: "italic",
                                display: "flex",
                                alignItems: "center",
                                gap: 0.5,
                                fontSize: "0.72rem",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                cursor: "pointer",
                                transition: "all 0.2s ease",
                                py: 0.25,
                                "&:hover": {
                                    color: "primary.main",
                                    bgcolor: alpha(
                                        theme.palette.primary.main,
                                        0.04,
                                    ),
                                    borderRadius: 0.5,
                                    px: 0.5,
                                },
                                ".group\\/cell:hover &": {
                                    display: "none",
                                },
                            }}
                            variant="caption"
                        >
                            💬 {localComment}
                        </Typography>
                    ) : null}

                    <Box
                        sx={{
                            display: isCommentFocused ? "block" : "none",
                            ".group\\/cell:hover &": {
                                display: "block",
                            },
                            ...(!hasComment && !isCommentFocused
                                ? {
                                    display: "none",
                                    ".group\\/cell:hover &": {
                                        display: "block",
                                    },
                                }
                                : {}),
                        }}
                    >
                        <TextField
                            fullWidth
                            multiline
                            onBlur={() => {
                                commitComment();
                                setIsCommentFocused(false);
                            }}
                            onChange={(event) =>
                                setLocalComment(event.target.value)
                            }
                            onFocus={() => setIsCommentFocused(true)}
                            placeholder="שם / הערה..."
                            size="small"
                            slotProps={{
                                input: {
                                    disableUnderline: !isCommentFocused,
                                    style: {
                                        fontSize: "0.72rem",
                                        color: theme.vars.palette.text.primary,
                                        padding: "2px 0",
                                    },
                                },
                            }}
                            sx={{
                                "& .MuiInput-root:hover::before": {
                                    borderBottom:
                                        "1px solid rgba(0, 0, 0, 0.42) !important",
                                },
                            }}
                            value={localComment}
                            variant="standard"
                        />
                    </Box>
                </Box>
            </Box>
        </TableCell>
    );
}
