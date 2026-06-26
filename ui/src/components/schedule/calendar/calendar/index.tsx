/**
 * Name: BluzCalendar.tsx
 * Purpose: Entry point for the Bluz Schedule Calendar.
 * Created: 2026-04-18
 * Author: Michael K. Steinberg
 */

"use client";
import FilterListIcon from "@mui/icons-material/FilterList";
import FullscreenIcon from "@mui/icons-material/Fullscreen";
import FullscreenExitIcon from "@mui/icons-material/FullscreenExit";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import {
    Dispatch,
    SetStateAction,
    useCallback,
    useEffect,
    useMemo,
    useState,
} from "react";
import { View, Views } from "react-big-calendar";

import { useCalendarFilters } from "@/components/base/CalendarFilterProvider";
import { useRooms } from "@/components/base/RoomsProvider";
import { CalendarView } from "@/components/schedule/calendar/calendar/CalendarView";
import { useCalendarHandlers } from "@/components/schedule/calendar/calendar/UseCalendarHandlers";
import { useCalendar } from "@/components/schedule/calendar/calendar-provider/CalendarContext";
import { getRangeForView } from "@/components/schedule/calendar/utils";
import { Event } from "@/components/schedule/types/event";

type BluzCalendarProps = {
    handleSaveEvent: (event: Event) => void;
    handleDeleteEvent: (eventId: Event["id"]) => void;
    setOpenEventDialog: (open: boolean) => void;
    setSelectedEvent: Dispatch<SetStateAction<Partial<Event> | undefined>>;
    events: Array<Event>;
};

export function BluzCalendar({
    handleSaveEvent,
    handleDeleteEvent,
    setOpenEventDialog,
    setSelectedEvent,
    events,
}: BluzCalendarProps) {
    const [mounted, setMounted] = useState(false);
    const [currentView, setCurrentView] = useState<View>(Views.WEEK);
    const [currentDate, setCurrentDate] = useState<Date>(() => new Date());
    const [showToolbar, setShowToolbar] = useState<boolean>(true);
    const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

    const { rooms } = useRooms();
    const { setStartDate, setEndDate } = useCalendar();
    const { showPAsFor, filteredCourses, filteredInstructors, hidePrayers } =
        useCalendarFilters();

    const hasAnyFilter = useMemo(
        () =>
            hidePrayers ||
            filteredCourses.length !== 0 ||
            filteredInstructors.length !== 0 ||
            showPAsFor !== null,
        [filteredCourses, filteredInstructors, showPAsFor, hidePrayers],
    );

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape" && isFullscreen) {
                setIsFullscreen(false);
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isFullscreen]);

    const { handleEventDrag, handleSlotSelect, setActiveEvent } =
        useCalendarHandlers(
            events,
            handleSaveEvent,
            handleDeleteEvent,
            setSelectedEvent,
            setOpenEventDialog,
        );

    // Only render the calendar after the component has mounted on the client.
    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- Standard hydration guard: must set mounted state after client mount
        setMounted(true);
    }, []);

    const updateDateRange = useCallback(
        (date: Date, view: View) => {
            const { start, end } = getRangeForView(date, view);
            console.log(
                "Updating date range:",
                start,
                end,
                "for view:",
                view,
                " from: ",
                date,
            );
            setStartDate(start);
            setEndDate(end);
        },
        [setStartDate, setEndDate],
    );

    const onNavigate = useCallback((newDate: Date) => {
        console.log("newDate: ", newDate);
        setCurrentDate(newDate);
    }, []);

    useEffect(() => {
        updateDateRange(currentDate, currentView);
    }, [currentDate, currentView, updateDateRange]);

    const handleEditEvent = useCallback(
        (event: Event) => {
            setSelectedEvent(event);
            setOpenEventDialog(true);
        },
        [setSelectedEvent, setOpenEventDialog],
    );

    const handleSelectEvent = useCallback(
        (event: Event) => {
            setActiveEvent(event);
            setSelectedEvent(event);
        },
        [setSelectedEvent, setActiveEvent],
    );

    if (!mounted) {
        return <div className="grow h-full bg-slate-50/50 animate-pulse" />;
    }

    return (
        <Box
            sx={
                isFullscreen
                    ? {
                        position: "fixed",
                        top: 0,
                        left: 0,
                        width: "100vw",
                        height: "100vh",
                        zIndex: 9999,
                        bgcolor: "background.paper",
                        p: 0,
                        boxSizing: "border-box",
                        display: "flex",
                        flexDirection: "column",
                        overflow: "hidden",
                        animation:
                              "fullscreen-enter 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
                        "@keyframes fullscreen-enter": {
                            "0%": {
                                transform: "scale(0.95)",
                                opacity: 0,
                            },
                            "100%": {
                                transform: "scale(1)",
                                opacity: 1,
                            },
                        },
                    }
                    : {
                        position: "relative",
                        height: "100%",
                        width: "100%",
                        display: "flex",
                        flexDirection: "column",
                        overflow: "hidden",
                        transition: "all 0.2s ease-in-out",
                    }
            }
        >
            {/* Floating controls in top-left corner (only when toolbar is hidden / in fullscreen) */}
            {isFullscreen || !showToolbar ? (
                <Box
                    style={{
                        position: "absolute",
                        top: 12,
                        left: 16,
                    }}
                    sx={{
                        zIndex: 100,
                        display: "flex",
                        alignItems: "center",
                        gap: 0.5,
                        bgcolor: "background.paper",
                        borderRadius: 1,
                        p: 0.5,
                        boxShadow: 2,
                        border: "1px solid",
                        borderColor: "divider",
                        transition: "all 0.2s ease-in-out",
                        "&:hover": {
                            boxShadow: 4,
                            transform: "translateY(-1px)",
                        },
                    }}
                >
                    {/* Filter indicator */}
                    {hasAnyFilter && (isFullscreen || !showToolbar) ? (
                        <Tooltip title="יש סננים פעילים">
                            <Box
                                sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    color: "info.main",
                                    px: 0.5,
                                }}
                            >
                                <FilterListIcon
                                    className="animate-pulse"
                                    fontSize="small"
                                />
                            </Box>
                        </Tooltip>
                    ) : null}

                    {isFullscreen ? (
                        <Tooltip title="צא ממסך מלא (Esc)">
                            <IconButton
                                onClick={() => setIsFullscreen(false)}
                                size="small"
                                sx={{
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
                                <FullscreenExitIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
                    ) : (
                        <>
                            <Tooltip
                                title={
                                    showToolbar
                                        ? "הסתר סרגל כלים"
                                        : "הצג סרגל כלים"
                                }
                            >
                                <IconButton
                                    onClick={() => setShowToolbar(!showToolbar)}
                                    size="small"
                                    sx={{
                                        transition: "all 0.2s ease-in-out",
                                        "&:hover": {
                                            transform: "scale(1.15)",
                                            color: "primary.main",
                                        },
                                        "&:active": {
                                            transform: "scale(0.95)",
                                        },
                                    }}
                                >
                                    {showToolbar ? (
                                        <VisibilityOffIcon fontSize="small" />
                                    ) : (
                                        <VisibilityIcon fontSize="small" />
                                    )}
                                </IconButton>
                            </Tooltip>
                            <Tooltip title="מסך מלא">
                                <IconButton
                                    onClick={() => setIsFullscreen(true)}
                                    size="small"
                                    sx={{
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
                                </IconButton>
                            </Tooltip>
                        </>
                    )}
                </Box>
            ) : null}

            <CalendarView
                currentView={currentView}
                date={currentDate}
                events={events}
                onDoubleClickEvent={handleEditEvent}
                onEventDrop={handleEventDrag}
                onNavigate={onNavigate}
                onSelectEvent={handleSelectEvent}
                onSelectSlot={handleSlotSelect}
                onToggleFullscreen={() => setIsFullscreen(true)}
                onToggleToolbar={() => setShowToolbar(!showToolbar)}
                onView={setCurrentView}
                rooms={rooms}
                showToolbar={showToolbar && !isFullscreen ? true : false}
            />
        </Box>
    );
}
