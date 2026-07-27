"use client";
import AddIcon from "@mui/icons-material/Add";
import CloudOffIcon from "@mui/icons-material/CloudOff";
import CloudQueueIcon from "@mui/icons-material/CloudQueue";
import RedoIcon from "@mui/icons-material/Redo";
import UndoIcon from "@mui/icons-material/Undo";
import { useMemo } from "react";

import { COMMAND_GROUPS } from "@/components/app-commands/labels";
import { useOffline } from "@/components/base/OfflineProvider";
import { Command, useCommands } from "@/components/command-palette";

export type ScheduleCommandActions = {
    createEvent: () => void;
    undo: () => void;
    redo: () => void;
};

/**
 * Schedule-page commands.
 *
 * These reach into page-local state (the event dialog) and are therefore
 * contributed by the page itself — they disappear from the palette on the gantt
 * surface, where they would be meaningless.
 */
export function useScheduleCommands({
    createEvent,
    undo,
    redo,
}: ScheduleCommandActions): void {
    const { offlineMode, setOfflineMode } = useOffline();

    const commands = useMemo<Array<Command>>(
        () => [
            {
                id: "schedule.event.new",
                title: "אירוע חדש",
                subtitle: "פתיחת חלון יצירת אירוע",
                group: COMMAND_GROUPS.schedule,
                kind: "command",
                icon: <AddIcon />,
                keywords: ["new event", "create event", "add", "אירוע"],
                priority: 1,
                run: createEvent,
            },
            {
                id: "schedule.undo",
                title: "ביטול פעולה",
                group: COMMAND_GROUPS.schedule,
                kind: "command",
                icon: <UndoIcon />,
                shortcut: ["Ctrl", "Z"],
                keywords: ["undo"],
                run: undo,
            },
            {
                id: "schedule.redo",
                title: "ביצוע חוזר",
                group: COMMAND_GROUPS.schedule,
                kind: "command",
                icon: <RedoIcon />,
                shortcut: ["Ctrl", "Y"],
                keywords: ["redo"],
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
                keywords: ["offline", "local", "לוקלי", "מנותק"],
                run: () => setOfflineMode(!offlineMode),
            },
        ],
        [createEvent, undo, redo, offlineMode, setOfflineMode],
    );

    useCommands(commands);
}
