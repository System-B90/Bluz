import MeetingRoomIcon from "@mui/icons-material/MeetingRoom";
import NoMeetingRoomIcon from "@mui/icons-material/NoMeetingRoom";
import WarningIcon from "@mui/icons-material/Warning";
import Box, { BoxProps } from "@mui/material/Box";
import { ChipProps } from "@mui/material/Chip";
import Link from "@mui/material/Link";
import Tooltip from "@mui/material/Tooltip";
import { useMemo } from "react";

import { getHiveBaseUrl } from "@/api-shared/common";
import { Room, RoomLike, RoomSource } from "@/api-shared/types/room";
import { useCalendarFilters } from "@/components/base/CalendarFilterProvider";
import { useRooms } from "@/components/base/RoomsProvider";
import { tagSx } from "@/components/schedule/event-component/parts/tag-sx";

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
        occupancy !== undefined &&
        roomCapacity >= 0 &&
        occupancy > roomCapacity;

    return (
        <Tooltip
            title={overcrowded ? `עומס יתר: ${occupancy}/${roomCapacity}` : ""}
        >
            <Box component="span" sx={tagSx({ overcrowded })}>
                {overcrowded ? (
                    <WarningIcon
                        color="warning"
                        sx={{ fontSize: "0.7rem", marginInlineStart: 0.3 }}
                    />
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
                    <NoMeetingRoomIcon
                        color="error"
                        sx={{ fontSize: "1.1rem" }}
                    />
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
            {/* The caption counts the rooms actually rendered, not the raw
                ids: an id that fails to resolve is filtered out above, so the
                caption read "חדרים" beside a single chip (#624). */}
            {showCaption !== false && (
                <Tooltip title={rooms.length === 1 ? "חדר" : "חדרים"}>
                    <MeetingRoomIcon
                        sx={{ fontSize: "0.85rem", opacity: 0.6 }}
                    />
                </Tooltip>
            )}
            {rooms.map((room) => (
                <SingleRoomTag
                    key={room.id}
                    occupancy={occupancy}
                    room={room}
                />
            ))}
        </Box>
    );
}
