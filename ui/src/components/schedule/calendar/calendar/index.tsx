"use client";
import FilterListIcon from "@mui/icons-material/FilterList";
import FullscreenIcon from "@mui/icons-material/Fullscreen";
import FullscreenExitIcon from "@mui/icons-material/FullscreenExit";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import moment from "moment";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
    Dispatch,
    SetStateAction,
    useCallback,
    useEffect,
    useMemo,
    useState,
} from "react";
import { View, Views } from "react-big-calendar";

import { EventChangeInitiator } from "@/api-shared/types/event-history";
import { useScheduleCommands } from "@/components/app-commands/use-schedule-commands";
import { useScheduleEventCommands } from "@/components/app-commands/use-schedule-event-commands";
import { useCalendarFilters } from "@/components/base/CalendarFilterProvider";
import { useRooms } from "@/components/base/RoomsProvider";
import { useConfirmDialog } from "@/components/base/UseConfirmDialog";
import { CalendarView } from "@/components/schedule/calendar/calendar/CalendarView";
import {
    GROWING_CONTROL_BUTTON_SX,
    PULSING_ICON_BUTTON_SX,
} from "@/components/schedule/calendar/calendar/toolbar-button-sx";
import { useCalendarHandlers } from "@/components/schedule/calendar/calendar/UseCalendarHandlers";
import { useCalendar } from "@/components/schedule/calendar/calendar-provider/CalendarContext";
import { InstructorDndProvider } from "@/components/schedule/calendar/instructor-dnd/InstructorDndProvider";
import { InstructorRail } from "@/components/schedule/calendar/instructor-dnd/InstructorRail";
import { getRangeForView } from "@/components/schedule/calendar/utils";
import { EventContextMenu } from "@/components/schedule/event-context-menu";
import { useEventContextMenu } from "@/components/schedule/event-context-menu/use-event-context-menu";
import { useEventSelection } from "@/components/schedule/event-context-menu/use-event-selection";
import { Event } from "@/components/schedule/types/event";

type BluzCalendarProps = {
    handleSaveEvent: (event: Event, initiator?: EventChangeInitiator) => Event | undefined | void;
    handleDeleteEvent: (
        eventId: Event["id"],
        initiator?: EventChangeInitiator,
    ) => void;
    setOpenEventDialog: (open: boolean) => void;
    setSelectedEvent: Dispatch<SetStateAction<Partial<Event> | undefined>>;
    events: Array<Event>;
    createEvent: () => void;
    undo: () => void;
    redo: () => void;
};

/**
 * Entry point component for the Bluz Schedule Calendar.
 * Renders the calendar view, toolbars, fullscreen toggle, and side filter drawer, integrating state and filters.
 * 
 * @param props - Component props containing events, selection states, and save/delete callback functions.
 * @returns The rendered React element.
 */
export function BluzCalendar({
    handleSaveEvent,
    handleDeleteEvent,
    setOpenEventDialog,
    setSelectedEvent,
    events,
    createEvent,
    undo,
    redo,
}: BluzCalendarProps) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const validViews = useMemo<Array<View>>(
        () => [Views.DAY, Views.WEEK, Views.WORK_WEEK],
        [],
    );
    const viewParam = searchParams.get("view") as null | View;
    const initialView =
        viewParam && validViews.includes(viewParam) ? viewParam : Views.WEEK;

    const [mounted, setMounted] = useState(false);
    const [currentView, setCurrentView] = useState<View>(initialView);
    const [currentDate, setCurrentDate] = useState<Date>(() => new Date());
    const [showToolbar, setShowToolbar] = useState<boolean>(true);
    const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

    const { rooms } = useRooms();
    const { startDate, endDate, setStartDate, setEndDate, isReadOnlyIteration } =
        useCalendar();
    // The provider's own flag, so the room filter counts too — the local
    // copy this replaced left it out and the indicator stayed dark with only
    // a room filter active.
    const { hasActiveFilters: hasAnyFilter } = useCalendarFilters();

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape" && isFullscreen) {
                setIsFullscreen(false);
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isFullscreen]);

    const { handleEventDrag, handleSplitEvent, handleSlotSelect, setActiveEvent } =
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
            setStartDate(start);
            setEndDate(end);
        },
        [setStartDate, setEndDate],
    );

    const handleToggleFullscreen = useCallback(() => setIsFullscreen(true), []);
    const handleToggleToolbar = useCallback(
        () => setShowToolbar((prev) => !prev),
        [],
    );

    const onNavigate = useCallback((newDate: Date) => {
        setCurrentDate(newDate);
    }, []);

    // Mirrors react-big-calendar's own PREV/NEXT stepping so palette
    // navigation matches the toolbar buttons: a day at a time in day view,
    // a week at a time otherwise.
    const stepDate = useCallback(
        (direction: -1 | 1) => {
            const unit = currentView === Views.DAY ? "day" : "week";
            setCurrentDate((prev) => moment(prev).add(direction, unit).toDate());
        },
        [currentView],
    );
    const navigatePrev = useCallback(() => stepDate(-1), [stepDate]);
    const navigateNext = useCallback(() => stepDate(1), [stepDate]);
    const navigateToday = useCallback(() => setCurrentDate(new Date()), []);

    const exportIcs = useCallback(() => {
        if (!startDate || !endDate) return;
        const params = new URLSearchParams({
            sd: startDate.toISOString(),
            ed: endDate.toISOString(),
        });
        window.open(`/api/event/export/ics?${params.toString()}`, "_blank");
    }, [startDate, endDate]);

    const handleViewChange = useCallback(
        (view: View) => {
            setCurrentView(view);
            const params = new URLSearchParams(searchParams.toString());
            params.set("view", view);
            router.replace(`${pathname}?${params.toString()}`, {
                scroll: false,
            });
        },
        [pathname, router, searchParams],
    );

    useScheduleCommands({
        createEvent,
        undo,
        redo,
        navigatePrev,
        navigateNext,
        navigateToday,
        setView: handleViewChange,
        toggleToolbar: handleToggleToolbar,
        toggleFullscreen: handleToggleFullscreen,
        exportIcs,
    });

    useEffect(() => {
        updateDateRange(currentDate, currentView);
    }, [currentDate, currentView, updateDateRange]);

    // The view owns `currentDate` and pushes its range into the context, so a
    // jump made through the context setters (snapshot restore) was pushed
    // straight back. Follow a range the view didn't produce (#653).
    useEffect(() => {
        if (!startDate) return;
        const { start, end } = getRangeForView(currentDate, currentView);
        if (startDate >= start && startDate <= end) return;
        // eslint-disable-next-line react-hooks/set-state-in-effect -- Syncs view state to an external range change
        setCurrentDate(startDate);
        // Only an outside change to the context range should move the view.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [startDate]);

    // The calendar resolves its own split pieces back to the canonical event
    // before calling out, so these only ever see whole events.
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

    useScheduleEventCommands({ events, onSelect: handleEditEvent });

    /* ── Right-click menu (#706) ─────────────────────────────── */

    const selection = useEventSelection(events);
    const { target: contextMenuTarget, openAt, close: closeContextMenu } =
        useEventContextMenu(selection);
    const { confirm, confirmDialog } = useConfirmDialog();

    // Every entry in the menu is a write, so a past iteration — which the
    // server rejects writes to — gets no menu at all rather than one whose
    // items all fail.
    const handleContextMenuEvent = isReadOnlyIteration ? null : openAt;

    // Escape drops the selection, matching the ring it clears on screen. The
    // menu swallows its own Escape (MUI closes it first), so this only ever
    // fires against a selection with no menu over it. Bound to `clear` rather
    // than to the selection object, which changes on every pick — there is no
    // reason to re-subscribe the listener each time.
    const clearSelection = selection.clear;
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") clearSelection();
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [clearSelection]);

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
                    sx={{
                        position: "absolute",
                        top: 12,
                        insetInlineStart: 16,
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
                        <Tooltip title="יש מסננים פעילים">
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
                                sx={PULSING_ICON_BUTTON_SX}
                            >
                                <FullscreenExitIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
                    ) : (
                        <>
                            <Tooltip
                                title={
                                    showToolbar
                                        ? "הסתרת סרגל כלים"
                                        : "הצגת סרגל כלים"
                                }
                            >
                                <IconButton
                                    onClick={() => setShowToolbar(!showToolbar)}
                                    size="small"
                                    sx={GROWING_CONTROL_BUTTON_SX}
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
                                    sx={PULSING_ICON_BUTTON_SX}
                                >
                                    <FullscreenIcon fontSize="small" />
                                </IconButton>
                            </Tooltip>
                        </>
                    )}
                </Box>
            ) : null}

            <InstructorDndProvider
                events={events}
                handleSaveEvent={handleSaveEvent}
            >
                <Box
                    sx={{
                        flexGrow: 1,
                        minHeight: 0,
                        display: "flex",
                        flexDirection: "row",
                        overflow: "hidden",
                    }}
                >
                    <CalendarView
                        currentView={currentView}
                        date={currentDate}
                        events={events}
                        onClearSelection={selection.clear}
                        onContextMenuEvent={handleContextMenuEvent}
                        onDoubleClickEvent={handleEditEvent}
                        onEventDrop={handleEventDrag}
                        onExportIcs={exportIcs}
                        onNavigate={onNavigate}
                        onSelectEvent={handleSelectEvent}
                        onSelectOnly={selection.selectOnly}
                        onSelectSlot={handleSlotSelect}
                        onSplitEvent={handleSplitEvent}
                        onToggleEventSelection={selection.toggle}
                        onToggleFullscreen={handleToggleFullscreen}
                        onToggleToolbar={handleToggleToolbar}
                        onView={handleViewChange}
                        rooms={rooms}
                        selectedEventIds={selection.selectedEventIds}
                        showToolbar={
                            showToolbar && !isFullscreen ? true : false
                        }
                    />
                    {/* Rail renders after the grid so RTL flow puts it on the
                        physical left edge. */}
                    <InstructorRail />
                </Box>
            </InstructorDndProvider>

            <EventContextMenu
                events={events}
                onClose={closeContextMenu}
                onConfirm={confirm}
                onDeleteEvent={handleDeleteEvent}
                onSaveEvent={handleSaveEvent}
                rooms={rooms}
                target={contextMenuTarget}
            />
            {confirmDialog}
        </Box>
    );
}
