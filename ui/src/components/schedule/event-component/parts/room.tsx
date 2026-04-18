import WarningIcon from "@mui/icons-material/Warning";
import {
  Box,
  BoxProps,
  Chip,
  ChipProps,
  Link,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import { useMemo } from "react";

import { getHiveBaseUrl } from "@/api-shared/common";
import { useRooms } from "@/components/base/RoomsProvider";
import { Room, RoomLike, RoomSource } from "@/components/schedule/types/room";

function SingleRoomComponent({
  room,
  occupancy,
  size,
  ...props
}: { room: Room; occupancy?: number } & ChipProps) {
  const roomCapacity =
    room.source === RoomSource.Hive ? (room?.users.length ?? -1) : -1;
  const overcrowded =
    occupancy !== undefined && roomCapacity >= 0 && occupancy > roomCapacity;

  return (
    <Tooltip
      title={overcrowded ? `עומס יתר: ${occupancy}/${roomCapacity}` : ""}
    >
      <Chip
        size={size ?? "small"}
        {...props}
        icon={
          overcrowded ? (
            <WarningIcon color="warning" fontSize="small" />
          ) : undefined
        }
        label={
          room.source === RoomSource.Hive ? (
            <Link
              color={"inherit"}
              href={`${getHiveBaseUrl()}/mentor/classes?id=${room?.id}`}
              underline="hover"
            >
              {" "}
              {room?.name}
            </Link>
          ) : undefined
        }
        sx={{ color: "inherit" }}
      />
    </Tooltip>
  );
}

export function RoomComponent({
  roomIds,
  occupancy,
  showCaption,
  chipSize,
  ...props
}: {
  roomIds: Array<RoomLike>;
  occupancy?: number;
  showCaption?: boolean;
  chipSize?: ChipProps["size"];
} & BoxProps) {
  const { getRoom } = useRooms();
  const rooms = useMemo(
    () => roomIds.map(getRoom).filter((v) => !!v),
    [roomIds, getRoom],
  );

  return (
    <Box
      alignItems={props.alignItems ?? "flex-start"}
      display={props.display ?? "flex"}
      flexDirection={props.flexDirection ?? "column"}
      gap={0.2}
      {...props}
    >
      {rooms.length === 0 ? (
        <Box alignItems={"center"} display={"flex"} flexDirection={"row"}>
          <WarningIcon
            color="error"
            fontSize="inherit"
            sx={{ verticalAlign: "middle", mr: 0.5 }}
          />
          <Typography color="error" fontWeight={600} variant="caption">
            אין חדר
          </Typography>
        </Box>
      ) : (
        <>
          {showCaption !== false && (
            <Typography fontWeight={600} noWrap variant="caption">
              {roomIds.length === 1 ? "חדר" : "חדרים"}
            </Typography>
          )}
          <Stack
            display={"flex"}
            flexDirection={props.flexDirection ?? "row"}
            flexWrap="wrap"
            gap={0.3}
          >
            {rooms.map((room) => (
              <SingleRoomComponent
                key={room.id}
                occupancy={occupancy}
                room={room}
                size={chipSize}
              />
            ))}
          </Stack>
        </>
      )}
    </Box>
  );
}
