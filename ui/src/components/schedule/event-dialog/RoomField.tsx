import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import FormControl from "@mui/material/FormControl";
import FormControlProps from "@mui/material/FormControlProps";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import SelectChangeEvent from "@mui/material/SelectChangeEvent";
import { useCallback, useState } from "react";

import {
    areRoomsEqual,
    ResolvableRoom,
    roomToKey,
    roomToResolvable,
} from "@/api-shared/types/room";
import { useRooms } from "@/components/base/RoomsProvider";
import { EventFieldProps } from "@/components/schedule/event-dialog/utils";
import { eventHasRoom } from "@/components/schedule/types/event";

type RoomFieldProps = {} & EventFieldProps;

export function RoomField({
    event,
    onBlurCallback,
    ...props
}: RoomFieldProps & FormControlProps) {
    const { rooms, getRoom } = useRooms();
    const [encodedSelectedRoomIds, setEncodedSelectedRoomIds] = useState(
        Array.isArray(event?.rooms)
            ? event.rooms.map((r) => JSON.stringify(r))
            : [],
    );

    const handleChange = useCallback(
        (event: SelectChangeEvent<typeof encodedSelectedRoomIds>) => {
            const {
                target: { value },
            } = event;

            // On autofill we get a stringified value.
            const newRooms = typeof value === "string" ? value.split(",") : value;

            setEncodedSelectedRoomIds(newRooms);
        },
        [],
    );

    const handleDelete = useCallback((roomIdToDelete: ResolvableRoom) => {
        setEncodedSelectedRoomIds(
            (p) =>
                p.filter(
                    (id) =>
                        !areRoomsEqual(JSON.parse(id) as ResolvableRoom, roomIdToDelete),
                ) ?? [],
        );
    }, []);

    const onClose = useCallback(() => {
        onBlurCallback({
            rooms: encodedSelectedRoomIds.map((v) => JSON.parse(v) as ResolvableRoom),
        });
    }, [encodedSelectedRoomIds, onBlurCallback]);

    return (
        <FormControl
            fullWidth={false}
            {...props}
            disabled={event?.type ? !eventHasRoom(event.type) : false}
        >
            <InputLabel>כיתות</InputLabel>
            <Select
                label="כיתות"
                multiple
                onChange={handleChange}
                onClose={onClose}
                renderValue={(selected: Array<string>) => (
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                        {selected
                            .map((encodedValue) => JSON.parse(encodedValue) as ResolvableRoom)
                            .map((value) => (
                                <Chip
                                    key={roomToKey(value)}
                                    label={getRoom(value)?.name || value.id}
                                    onDelete={() => handleDelete(value)}
                                    onMouseDown={(event) => event.stopPropagation()}
                                    size="small" // Optional: makes them fit better
                                />
                            ))}
                    </Box>
                )}
                value={encodedSelectedRoomIds}
            >
                {Object.values(rooms).map((room) => (
                    <MenuItem
                        key={roomToKey(room)}
                        value={JSON.stringify(roomToResolvable(room))}
                    >
                        {room.name}
                    </MenuItem>
                ))}
            </Select>
        </FormControl>
    );
}
