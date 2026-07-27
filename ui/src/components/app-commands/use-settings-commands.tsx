"use client";
import AssignmentIndIcon from "@mui/icons-material/AssignmentInd";
import EventRepeatIcon from "@mui/icons-material/EventRepeat";
import MeetingRoomIcon from "@mui/icons-material/MeetingRoom";
import PaletteIcon from "@mui/icons-material/Palette";
import PersonIcon from "@mui/icons-material/Person";
import SettingsIcon from "@mui/icons-material/Settings";
import { ReactNode, useMemo } from "react";

import { COMMAND_GROUPS } from "@/components/app-commands/labels";
import { useCommands } from "@/components/command-palette";
import {
    SettingsTab,
    useSettingsDialogUrl,
} from "@/components/settings-dialog/UseSettingsDialogUrl";

type TabCommand = {
    tab: SettingsTab;
    title: string;
    icon: ReactNode;
    keywords: Array<string>;
};

/**
 * Mirrors the sidebar of `SettingsDialog` — same labels, same icons, same
 * order — so the palette and the dialog read alike.
 */
const TABS: Array<TabCommand> = [
    {
        tab: "personal",
        title: "אישי",
        icon: <PersonIcon />,
        keywords: ["personal", "profile"],
    },
    {
        tab: "global",
        title: "כללי",
        icon: <SettingsIcon />,
        keywords: ["global", "general"],
    },
    {
        tab: "colors",
        title: "צבעים",
        icon: <PaletteIcon />,
        keywords: ["colors", "palette"],
    },
    {
        tab: "rooms",
        title: "חדרים",
        icon: <MeetingRoomIcon />,
        keywords: ["rooms", "classes"],
    },
    {
        tab: "outsiders",
        title: "אנשי חוץ",
        icon: <AssignmentIndIcon />,
        keywords: ["outsiders", "guests"],
    },
    {
        tab: "iterations",
        title: "מחזורים",
        icon: <EventRepeatIcon />,
        keywords: ["iterations", "cycles"],
    },
];

/** One command per settings tab, deep-linking straight into it. */
export function useSettingsCommands(): void {
    const { openDialog } = useSettingsDialogUrl();

    const commands = useMemo(
        () =>
            TABS.map(({ tab, title, icon, keywords }) => ({
                id: `settings.${tab}`,
                title: `הגדרות: ${title}`,
                group: COMMAND_GROUPS.settings,
                kind: "command" as const,
                icon,
                keywords: ["settings", "preferences", "הגדרות", ...keywords],
                run: () => openDialog(tab),
            })),
        [openDialog],
    );

    useCommands(commands);
}
