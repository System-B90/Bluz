"use client";
import AssignmentIndIcon from "@mui/icons-material/AssignmentInd";
import MeetingRoomIcon from "@mui/icons-material/MeetingRoom";
import { Command, useCommands } from "@system-b90/command-palette";
import { useMemo } from "react";

import { COMMAND_GROUPS } from "@/components/app-commands/labels";
import { useOutsiders } from "@/components/base/OutsidersProvider";
import { useRooms } from "@/components/base/RoomsProvider";
import { useSettingsDialogUrl } from "@/components/settings-dialog/UseSettingsDialogUrl";

/**
 * Entity lane (`@`) over the org directory that both product surfaces share:
 * rooms and outsiders. Selecting one deep-links into its settings tab with the
 * record already open for editing.
 */
export function useDirectoryCommands(): void {
    const { rooms } = useRooms();
    const { outsiders } = useOutsiders();
    const { openDialog } = useSettingsDialogUrl();

    const commands = useMemo<Array<Command>>(() => {
        const roomCommands = rooms.map((room) => ({
            id: `room.${room.source}.${room.id}`,
            title: room.name,
            subtitle: room.description || COMMAND_GROUPS.rooms,
            group: COMMAND_GROUPS.rooms,
            kind: "entity" as const,
            icon: <MeetingRoomIcon />,
            keywords: ["room", "חדר"],
            run: () =>
                // Only custom rooms carry a string id, which is what the rooms
                // tab matches `editRoom` against; Hive rooms just open the tab.
                openDialog(
                    "rooms",
                    typeof room.id === "string"
                        ? { editRoom: room.id }
                        : undefined,
                ),
        }));

        const outsiderCommands = outsiders.map((outsider) => ({
            id: `outsider.${outsider.id}`,
            title: outsider.name,
            subtitle: outsider.phone || COMMAND_GROUPS.outsiders,
            group: COMMAND_GROUPS.outsiders,
            kind: "entity" as const,
            icon: <AssignmentIndIcon />,
            keywords: ["outsider", "איש חוץ"],
            run: () =>
                openDialog("outsiders", { editOutsider: outsider.id }),
        }));

        return [...roomCommands, ...outsiderCommands];
    }, [rooms, outsiders, openDialog]);

    useCommands(commands);
}
