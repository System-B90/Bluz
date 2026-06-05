/**
 * Name: CalendarToolbar.tsx
 * Purpose: Custom header toolbar for the calendar containing navigation, date picker, and view tabs.
 * Created: 2026-06-04
 * Author: Antigravity
 */

import FullscreenIcon from "@mui/icons-material/Fullscreen";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import { Box, Button, ButtonGroup, Collapse, Tooltip, Typography } from "@mui/material";
import { DatePicker } from "@mui/x-date-pickers";
import dayjs from "dayjs";
import { useCallback, useMemo } from "react";
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
    const handleDateChange = useCallback((val: dayjs.Dayjs | null) => {
        if (val && val.isValid()) {
            onNavigate("DATE", val.toDate());
        }
    }, [onNavigate]);

    const isTodayShown = useMemo(() => {
        const today = dayjs();
        const calendarDate = dayjs(date);
        if (view === "day") {
            return calendarDate.isSame(today, "day");
        }
        if (view === "week") {
            const start = calendarDate.day(0).startOf("day");
            const end = calendarDate.day(6).endOf("day");
            return (today.isSame(start) || today.isAfter(start)) && (today.isSame(end) || today.isBefore(end));
        }
        if (view === "work_week") {
            const start = calendarDate.day(0).startOf("day");
            const end = calendarDate.day(4).endOf("day");
            return (today.isSame(start) || today.isAfter(start)) && (today.isSame(end) || today.isBefore(end));
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
                        theme.palette.mode === "dark" ? "background.default" : "transparent",
                }}
                width="100%"
            >
                <Box alignItems="center" display="flex" flexWrap="wrap" gap={1.5}>
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

                    <DatePicker
                        format="DD/MM/YYYY"
                        onChange={handleDateChange}
                        slotProps={{
                            textField: {
                                size: "small",
                                sx: {
                                    width: 140,
                                    "& .MuiInputBase-root": {
                                        height: 30.75, // Matches standard small MUI buttons height
                                    },
                                },
                            },
                        }}
                        value={dayjs(date)}
                    />
                </Box>

                <Typography fontWeight="bold" variant="h6">
                    {label}
                </Typography>

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
                            variant={view === "work_week" ? "contained" : "outlined"}
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
                                    }
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
                                        animation: "pulse-expand 1.2s infinite ease-in-out",
                                    },
                                    "@keyframes pulse-expand": {
                                        "0%, 100%": {
                                            transform: "scale(1)",
                                        },
                                        "50%": {
                                            transform: "scale(1.25)",
                                        }
                                    },
                                    "&:active": {
                                        transform: "scale(0.95)",
                                    }
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
