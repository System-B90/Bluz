import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import {
    Box,
    Chip,
    IconButton,
    TableCell,
    TextField,
    Tooltip,
    Typography,
    alpha,
    useTheme,
} from "@mui/material";
import { useSnackbar } from "notistack";
import { KeyboardEvent, useCallback, useMemo, useState } from "react";

import { enqueueApiErrorSnackbar } from "@/api-client/common";
import {
    GanttDayId,
    GanttDayIndex,
    getDayNameDisplay,
} from "@/api-shared/types/gantt/models";
import {
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

export type DayCapacityCellProps = {
  dayId: GanttDayId;
  isMuted?: boolean;
  scheduledMinutes: number;
  startDate: null | string;
  weekIndex: number;
};

function getStatusColor(status: CapacityStatus): "default" | "error" | "primary" | "warning" {
    if (status === "error") return "error";
    if (status === "warning") return "warning";
    if (status === "ok") return "primary";

    return "default";
}

export function DayCapacityCell({
    dayId,
    isMuted = false,
    scheduledMinutes,
    startDate,
    weekIndex,
}: DayCapacityCellProps) {
    const theme = useTheme();
    const { enqueueSnackbar } = useSnackbar();
    const day = useCurriculumDay(dayId);
    const { updateDay } = useWeekActions();

    const [localTime, setLocalTime] = useState(() =>
        formatMinutesAsTimeInput(day?.totalWorkingMinutes ?? 0),
    );
    const [localComment, setLocalComment] = useState(day?.comment ?? "");

    const status = useMemo(
        () => getCapacityStatus(day?.totalWorkingMinutes ?? 0, scheduledMinutes),
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

        void updateDay(dayId, { totalWorkingMinutes: parsedMinutes }).catch((error) =>
            enqueueApiErrorSnackbar(enqueueSnackbar, "שמירת שעות נכשלה!", error),
        );
    }, [day, dayId, enqueueSnackbar, localTime, updateDay]);

    const commitComment = useCallback(() => {
        if (!day || localComment === (day.comment ?? "")) return;

        void updateDay(dayId, { comment: localComment }).catch((error) =>
            enqueueApiErrorSnackbar(enqueueSnackbar, "שמירת הערת יום נכשלה!", error),
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
            void updateDay(dayId, { totalWorkingMinutes: nextMinutes }).catch((error) =>
                enqueueApiErrorSnackbar(enqueueSnackbar, "שמירת שעות נכשלה!", error),
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
        if (isMuted) return alpha(theme.palette.action.disabledBackground, 0.45);
        if (status === "error") return alpha(theme.palette.error.main, 0.08);
        if (status === "warning") return alpha(theme.palette.warning.main, 0.12);
        if (status === "ok") return alpha(theme.palette.primary.main, 0.08);

        return "background.paper";
    }, [isMuted, status, theme]);

    if (!day) {
        return <TableCell sx={{ minWidth: 154 }} />;
    }

    const dayName = getDayNameDisplay(day.dayIndex);
    const isSaturday = day.dayIndex === GanttDayIndex.Saturday;

    return (
        <TableCell
            sx={{
                minWidth: 160,
                maxWidth: 180,
                p: 1,
                bgcolor: backgroundColor,
                borderInlineStart: 1,
                borderColor: "divider",
                opacity: isMuted ? 0.72 : 1,
                verticalAlign: "top",
            }}
        >
            <Box display="flex" flexDirection="column" gap={0.75}>
                <Box alignItems="center" display="flex" justifyContent="space-between">
                    <Typography fontWeight={700} variant="caption">
                        {dayName}
                        {dateLabel ? ` ${dateLabel}` : ""}
                    </Typography>
                    {isSaturday && isMuted ? (
                        <Typography color="text.secondary" variant="caption">
              יוצאים
                        </Typography>
                    ) : null}
                </Box>
                <Box
                    alignItems="center"
                    display="grid"
                    gap={0.5}
                    gridTemplateColumns="24px 1fr 24px"
                >
                    <Tooltip title="הפחתת שעה">
                        <IconButton onClick={() => adjustMinutes(-60)} size="small">
                            <RemoveIcon fontSize="inherit" />
                        </IconButton>
                    </Tooltip>
                    <TextField
                        inputProps={{
                            inputMode: "numeric",
                            style: { fontFamily: "monospace", textAlign: "center" },
                        }}
                        onBlur={commitTime}
                        onChange={(event) => setLocalTime(event.target.value)}
                        onKeyDown={handleTimeKeyDown}
                        size="small"
                        value={localTime}
                    />
                    <Tooltip title="הוספת שעה">
                        <IconButton onClick={() => adjustMinutes(60)} size="small">
                            <AddIcon fontSize="inherit" />
                        </IconButton>
                    </Tooltip>
                </Box>
                <Chip
                    color={getStatusColor(status)}
                    label={`${formatHoursLabel(scheduledMinutes)} משובץ | ${statusLabel}`}
                    size="small"
                    sx={{ maxWidth: "100%" }}
                    variant="outlined"
                />
                <TextField
                    fullWidth
                    multiline
                    onBlur={commitComment}
                    onChange={(event) => setLocalComment(event.target.value)}
                    placeholder="שם / הערה"
                    size="small"
                    value={localComment}
                    variant="standard"
                />
            </Box>
        </TableCell>
    );
}
