"use client";
import AddIcon from "@mui/icons-material/Add";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import CloudOffIcon from "@mui/icons-material/CloudOff";
import CloudQueueIcon from "@mui/icons-material/CloudQueue";
import EastIcon from "@mui/icons-material/East";
import EventIcon from "@mui/icons-material/Event";
import Filter1Icon from "@mui/icons-material/Filter1";
import Filter5Icon from "@mui/icons-material/Filter5";
import Filter7Icon from "@mui/icons-material/Filter7";
import FullscreenIcon from "@mui/icons-material/Fullscreen";
import RedoIcon from "@mui/icons-material/Redo";
import UndoIcon from "@mui/icons-material/Undo";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import WestIcon from "@mui/icons-material/West";
import { useMemo } from "react";
import { View } from "react-big-calendar";

import { COMMAND_GROUPS } from "@/components/app-commands/labels";
import { useOffline } from "@/components/base/OfflineProvider";
import { Command, useCommands } from "@/components/command-palette";

export type ScheduleCommandActions = {
    createEvent: () => void;
    undo: () => void;
    redo: () => void;
    navigatePrev: () => void;
    navigateNext: () => void;
    navigateToday: () => void;
    setView: (view: View) => void;
    toggleToolbar: () => void;
    toggleFullscreen: () => void;
    exportIcs: () => void;
};

/**
 * Schedule-page commands.
 *
 * These reach into page-local state (the event dialog, the calendar's own
 * nav/view/toolbar state) and are therefore contributed by the page itself —
 * they disappear from the palette on the gantt surface, where they would be
 * meaningless.
 */
export function useScheduleCommands({
    createEvent,
    undo,
    redo,
    navigatePrev,
    navigateNext,
    navigateToday,
    setView,
    toggleToolbar,
    toggleFullscreen,
    exportIcs,
}: ScheduleCommandActions): void
{
    const { offlineMode, setOfflineMode } = useOffline();

    const commands = useMemo<Array<Command>>(
        () => [
            {
                id: "schedule.event.new",
                title: "אירוע חדש",
                subtitle: "מופע חלון יצירת אירוע",
                group: COMMAND_GROUPS.schedule,
                kind: "command",
                icon: <AddIcon />,
                keywords: [ "new event", "create event", "add", "אירוע", "מופע", "שיעור", "הרצאה" ],
                priority: 1,
                run: createEvent,
            },
            {
                id: "schedule.undo",
                title: "ביטול פעולה",
                group: COMMAND_GROUPS.schedule,
                kind: "command",
                icon: <UndoIcon />,
                shortcut: [ "Ctrl", "Z" ],
                keywords: [ "undo" ],
                run: undo,
            },
            {
                id: "schedule.redo",
                title: "ביצוע חוזר",
                group: COMMAND_GROUPS.schedule,
                kind: "command",
                icon: <RedoIcon />,
                shortcut: [ "Ctrl", "Y" ],
                keywords: [ "redo" ],
                run: redo,
            },
            {
                id: "schedule.offline.toggle",
                title: offlineMode
                    ? "יציאה ממצב עריכה לוקלי"
                    : "כניסה למצב עריכה לוקלי",
                group: COMMAND_GROUPS.schedule,
                kind: "command",
                icon: offlineMode ? <CloudQueueIcon /> : <CloudOffIcon />,
                keywords: [ "offline", "local", "לוקלי", "מנותק" ],
                run: () => setOfflineMode(!offlineMode),
            },
            {
                id: "schedule.navigate.prev",
                title: "תקופה קודמת",
                group: COMMAND_GROUPS.schedule,
                kind: "command",
                icon: <EastIcon />,
                shortcut: [ "Ctrl", "ArrowRight" ],
                keywords: [ "previous", "prev", "back", "קודם", "אחורה" ],
                run: navigatePrev,
            },
            {
                id: "schedule.navigate.next",
                title: "תקופה הבאה",
                group: COMMAND_GROUPS.schedule,
                kind: "command",
                icon: <WestIcon />,
                shortcut: [ "Ctrl", "ArrowLeft" ],
                keywords: [ "next", "forward", "הבא", "קדימה" ],
                run: navigateNext,
            },
            {
                id: "schedule.navigate.today",
                title: "היום",
                group: COMMAND_GROUPS.schedule,
                kind: "command",
                icon: <CalendarTodayIcon />,
                keywords: [ "today", "היום" ],
                run: navigateToday,
            },
            {
                id: "schedule.view.day",
                title: "תצוגת יום",
                group: COMMAND_GROUPS.schedule,
                kind: "command",
                icon: <Filter1Icon />,
                keywords: [ "day view", "יום", "1", ],
                run: () => setView("day"),
            },
            {
                id: "schedule.view.work_week",
                title: "תצוגת שבוע עבודה",
                group: COMMAND_GROUPS.schedule,
                kind: "command",
                icon: <Filter5Icon />,
                keywords: [ "work week view", "שבוע עבודה", "5" ],
                run: () => setView("work_week"),
            },
            {
                id: "schedule.view.week",
                title: "תצוגת שבוע",
                group: COMMAND_GROUPS.schedule,
                kind: "command",
                icon: <Filter7Icon />,
                keywords: [ "week view", "שבוע", "7", "שבת" ],
                run: () => setView("week"),
            },
            {
                id: "schedule.toolbar.toggle",
                title: "הצגה/הסתרה של סרגל הכלים",
                group: COMMAND_GROUPS.schedule,
                kind: "command",
                icon: <VisibilityOffIcon />,
                keywords: [ "toolbar", "hide", "show", "סרגל כלים" ],
                run: toggleToolbar,
            },
            {
                id: "schedule.fullscreen.toggle",
                title: "מסך מלא",
                group: COMMAND_GROUPS.schedule,
                kind: "command",
                icon: <FullscreenIcon />,
                keywords: [ "fullscreen", "מסך מלא" ],
                run: toggleFullscreen,
            },
            {
                id: "schedule.export.ics",
                title: "ייצוא ל-ICS",
                group: COMMAND_GROUPS.schedule,
                kind: "command",
                icon: <EventIcon />,
                keywords: [ "export", "ics", "ייצוא" ],
                run: exportIcs,
            },
        ],
        [
            createEvent,
            undo,
            redo,
            offlineMode,
            setOfflineMode,
            navigatePrev,
            navigateNext,
            navigateToday,
            setView,
            toggleToolbar,
            toggleFullscreen,
            exportIcs,
        ],
    );

    useCommands(commands);
}
