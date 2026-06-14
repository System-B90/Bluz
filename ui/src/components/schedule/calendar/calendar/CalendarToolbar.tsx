/**
 * Name: CalendarToolbar.tsx
 * Purpose: Custom header toolbar for the calendar containing navigation, date picker, and view tabs.
 * Created: 2026-06-04
 * Author: Antigravity
 */

import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import FullscreenIcon from "@mui/icons-material/Fullscreen";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import ButtonGroup from "@mui/material/ButtonGroup";
import Collapse from "@mui/material/Collapse";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { DatePicker } from "@mui/x-date-pickers";
import dayjs from "dayjs";
import { useCallback, useMemo, useState } from "react";
import { ToolbarProps } from "react-big-calendar";

import { CALENDAR_MESSAGES } from "@/components/CalendarMessages";

export function CalendarToolbar({
    date,
    label,
    onNavigate,
    onView,
    view,
    showToolbar,
    onToggleFullscreen,
    onToggleToolbar,
}: ToolbarProps<any, any> & {
    showToolbar: boolean;
    onToggleFullscreen: () => void;
    onToggleToolbar: () => void;
}) {
    const [open, setOpen] = useState(false);

    const handleDateChange = useCallback(
        (val: dayjs.Dayjs | null) => {
            if (val && val.isValid()) {
                onNavigate("DATE", val.toDate());
            }
        },
        [onNavigate],
    );

    const isTodayShown = useMemo(() => {
        const today = dayjs();
        const calendarDate = dayjs(date);
        if (view === "day") {
            return calendarDate.isSame(today, "day");
        }
        if (view === "week") {
            const start = calendarDate.day(0).startOf("day");
            const end = calendarDate.day(6).endOf("day");
            return (
                (today.isSame(start) || today.isAfter(start)) &&
                (today.isSame(end) || today.isBefore(end))
            );
        }
        if (view === "work_week") {
            const start = calendarDate.day(0).startOf("day");
            const end = calendarDate.day(4).endOf("day");
            return (
                (today.isSame(start) || today.isAfter(start)) &&
                (today.isSame(end) || today.isBefore(end))
            );
        }
        return false;
    }, [date, view]);

    return (
        <Collapse in={showToolbar}>
            <Box
                alignItems="center"
                display="flex"
                flexWrap="wrap"
                gap={2}
                justifyContent="space-between"
                px={2}
                py={1.5}
                sx={{
                    borderBottom: "1px solid",
                    borderColor: "divider",
                    bgcolor: (theme) =>
                        theme.palette.mode === "dark"
                            ? "background.default"
                            : "transparent",
                }}
                width="100%"
            >
                <Box
                    alignItems="center"
                    display="flex"
                    flexWrap="wrap"
                    gap={1.5}
                >
                    <ButtonGroup size="small" variant="outlined">
                        <Button onClick={() => onNavigate("PREV")}>
                            {CALENDAR_MESSAGES.previous}
                        </Button>
                        <Button
                            onClick={() => onNavigate("TODAY")}
                            variant={isTodayShown ? "contained" : "outlined"}
                        >
                            {CALENDAR_MESSAGES.today}
                        </Button>
                        <Button onClick={() => onNavigate("NEXT")}>
                            {CALENDAR_MESSAGES.next}
                        </Button>
                    </ButtonGroup>
                </Box>

                <Box alignItems="center" display="flex" gap={1}>
                    <Typography
                        fontWeight="bold"
                        sx={{ color: "text.primary" }}
                        variant="h6"
                    >
                        {label}
                    </Typography>
                    <IconButton
                        onClick={() => setOpen(true)}
                        size="small"
                        sx={{
                            color: "text.secondary",
                            transition: "all 0.2s ease-in-out",
                            "&:hover": {
                                color: "primary.main",
                                transform: "scale(1.1)",
                            },
                            "&:active": {
                                transform: "scale(0.95)",
                            },
                        }}
                    >
                        <CalendarTodayIcon fontSize="small" />
                    </IconButton>
                    <DatePicker
                        format="DD/MM/YYYY"
                        onChange={(val) => {
                            handleDateChange(val);
                            setOpen(false);
                        }}
                        onClose={() => setOpen(false)}
                        open={open}
                        slotProps={{
                            textField: {
                                sx: {
                                    position: "absolute",
                                    width: 0,
                                    height: 0,
                                    opacity: 0,
                                    pointerEvents: "none",
                                },
                            },
                        }}
                        value={dayjs(date)}
                    />
                </Box>

                <Box alignItems="center" display="flex" gap={1.5}>
                    <ButtonGroup size="small" variant="outlined">
                        <Button
                            onClick={() => onView("day")}
                            variant={view === "day" ? "contained" : "outlined"}
                        >
                            {CALENDAR_MESSAGES.day}
                        </Button>
                        <Button
                            onClick={() => onView("work_week")}
                            variant={
                                view === "work_week" ? "contained" : "outlined"
                            }
                        >
                            {CALENDAR_MESSAGES.work_week}
                        </Button>
                        <Button
                            onClick={() => onView("week")}
                            variant={view === "week" ? "contained" : "outlined"}
                        >
                            {CALENDAR_MESSAGES.week}
                        </Button>
                    </ButtonGroup>

                    <ButtonGroup size="small" variant="outlined">
                        <Tooltip title="הסתר סרגל כלים">
                            <Button
                                onClick={onToggleToolbar}
                                sx={{
                                    minWidth: 38,
                                    transition: "all 0.2s ease-in-out",
                                    "&:hover": {
                                        color: "primary.main",
                                    },
                                    "&:active": {
                                        transform: "scale(0.95)",
                                    },
                                }}
                            >
                                <VisibilityOffIcon fontSize="small" />
                            </Button>
                        </Tooltip>
                        <Tooltip title="מסך מלא">
                            <Button
                                onClick={onToggleFullscreen}
                                sx={{
                                    minWidth: 38,
                                    transition: "all 0.2s ease-in-out",
                                    "&:hover": {
                                        color: "primary.main",
                                    },
                                    "&:hover .MuiSvgIcon-root": {
                                        animation:
                                            "pulse-expand 1.2s infinite ease-in-out",
                                    },
                                    "@keyframes pulse-expand": {
                                        "0%, 100%": {
                                            transform: "scale(1)",
                                        },
                                        "50%": {
                                            transform: "scale(1.25)",
                                        },
                                    },
                                    "&:active": {
                                        transform: "scale(0.95)",
                                    },
                                }}
                            >
                                <FullscreenIcon fontSize="small" />
                            </Button>
                        </Tooltip>
                    </ButtonGroup>
                </Box>
            </Box>
        </Collapse>
    );
}
