import MeetingRoomIcon from "@mui/icons-material/MeetingRoom";
import NoMeetingRoomIcon from "@mui/icons-material/NoMeetingRoom";
import WarningIcon from "@mui/icons-material/Warning";
import Box from "@mui/material/Box";
import BoxProps from "@mui/material/BoxProps";
import ChipProps from "@mui/material/ChipProps";
import Link from "@mui/material/Link";
import Tooltip from "@mui/material/Tooltip";
import { useMemo } from "react";

import { getHiveBaseUrl } from "@/api-shared/common";
import { Room, RoomLike, RoomSource } from "@/api-shared/types/room";
import { useCalendarFilters } from "@/components/base/CalendarFilterProvider";
import { useRooms } from "@/components/base/RoomsProvider";

/** Lightweight tag — matching the unified tag style. */
const tagSx = (overcrowded: boolean) => ({
    display: "inline-flex",
    alignItems: "center",
    px: 0.6,
    py: 0.1,
    borderRadius: "4px",
    fontSize: "0.72rem",
    lineHeight: 1.4,
    fontWeight: 400,
    whiteSpace: "nowrap" as const,
    border: "1px solid",
    borderColor: overcrowded ? "warning.main" : "var(--event-border)",
    color: "inherit",
});

function SingleRoomTag({
    room,
    occupancy,
}: {
  room: Room;
  occupancy?: number;
}) {
    const roomCapacity =
    room.source === RoomSource.Hive ? (room?.users.length ?? -1) : -1;
    const overcrowded =
    occupancy !== undefined && roomCapacity >= 0 && occupancy > roomCapacity;

    return (
        <Tooltip
            title={overcrowded ? `עומס יתר: ${occupancy}/${roomCapacity}` : ""}
        >
            <Box component="span" sx={tagSx(overcrowded)}>
                {overcrowded ? (
                    <WarningIcon color="warning" sx={{ fontSize: "0.7rem", mr: 0.3 }} />
                ) : null}
                {room.source === RoomSource.Hive ? (
                    <Link
                        color="inherit"
                        href={`${getHiveBaseUrl()}/mentor/classes?id=${room?.id}`}
                        underline="hover"
                    >
                        {room?.name}
                    </Link>
                ) : (
                    room?.name
                )}
            </Box>
        </Tooltip>
    );
}

export function RoomComponent({
    roomIds,
    occupancy,
    showCaption,
    chipSize: _chipSize,
    ...props
}: {
  roomIds: Array<RoomLike>;
  occupancy?: number;
  showCaption?: boolean;
  chipSize?: ChipProps["size"];
} & BoxProps) {
    const { getRoom } = useRooms();
    const { showMisconfigurations } = useCalendarFilters();
    const rooms = useMemo(
        () => roomIds.map(getRoom).filter((v) => !!v),
        [roomIds, getRoom],
    );

    if (rooms.length === 0) {
        if (!showMisconfigurations) {
            return null;
        }
        return (
            <Tooltip title="אין כיתה">
                <Box
                    alignItems="center"
                    display="flex"
                    flexDirection="row"
                    gap={0.4}
                    {...props}
                >
                    <NoMeetingRoomIcon color="error" sx={{ fontSize: "1.1rem" }} />
                </Box>
            </Tooltip>
        );
    }

    return (
        <Box
            alignItems="center"
            display="flex"
            flexDirection="row"
            flexWrap="wrap"
            gap={0.4}
            {...props}
        >
            {showCaption !== false && (
                <Tooltip title={roomIds.length === 1 ? "חדר" : "חדרים"}>
                    <MeetingRoomIcon sx={{ fontSize: "0.85rem", opacity: 0.6 }} />
                </Tooltip>
            )}
            {rooms.map((room) => (
                <SingleRoomTag key={room.id} occupancy={occupancy} room={room} />
            ))}
        </Box>
    );
}
