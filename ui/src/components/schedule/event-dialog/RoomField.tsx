import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import FormControl, { FormControlProps } from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select, { SelectChangeEvent } from "@mui/material/Select";
import { useCallback, useState, useId } from "react";

import {
    areRoomsEqual,
    ResolvableRoom,
    roomLikeToResourceKey,
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
    const labelId = useId();
    const { rooms, getRoom } = useRooms();
    const [encodedSelectedRoomIds, setEncodedSelectedRoomIds] = useState(
        Array.isArray(event?.rooms)
            ? event.rooms.map((r) => JSON.stringify(r))
            : [],
    );

    // The initial useState value only runs once, so if the edited event
    // changed underneath us mid-session (e.g. a WS update while the dialog
    // is open) the selection would keep showing stale rooms without help.
    // The caller (EventClassification.tsx) remounts this component with
    // key={`${event.id}-${event.updatedAt}`}, which resets this state
    // instead of relying on an effect to resync it.
    const handleChange = useCallback(
        (event: SelectChangeEvent<typeof encodedSelectedRoomIds>) => {
            const {
                target: { value },
            } = event;

            // On autofill we get a stringified value.
            const newRooms =
                typeof value === "string" ? value.split(",") : value;

            setEncodedSelectedRoomIds(newRooms);
        },
        [],
    );

    const handleDelete = useCallback(
        (roomIdToDelete: ResolvableRoom) => {
            const remaining = encodedSelectedRoomIds.filter(
                (id) =>
                    !areRoomsEqual(
                        JSON.parse(id) as ResolvableRoom,
                        roomIdToDelete,
                    ),
            );
            setEncodedSelectedRoomIds(remaining);
            // The chip's own onMouseDown stops the menu from opening, so
            // onClose never fires and the removal reached nothing but local
            // state — the room was still saved (#616).
            onBlurCallback({
                rooms: remaining.map((v) => JSON.parse(v) as ResolvableRoom),
            });
        },
        [encodedSelectedRoomIds, onBlurCallback],
    );

    const onClose = useCallback(() => {
        onBlurCallback({
            rooms: encodedSelectedRoomIds.map(
                (v) => JSON.parse(v) as ResolvableRoom,
            ),
        });
    }, [encodedSelectedRoomIds, onBlurCallback]);

    return (
        <FormControl
            fullWidth={false}
            {...props}
            disabled={event?.type ? !eventHasRoom(event.type) : false}
        >
            <InputLabel id={ labelId }>כיתות</InputLabel>
            <Select label="כיתות"
                labelId={ labelId }
                multiple
                onChange={handleChange}
                onClose={onClose}
                renderValue={(selected: Array<string>) => (
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                        {selected
                            .map(
                                (encodedValue) =>
                                    JSON.parse(encodedValue) as ResolvableRoom,
                            )
                            .map((value) => (
                                <Chip
                                    key={roomLikeToResourceKey(value)}
                                    label={getRoom(value)?.name || value.id}
                                    onDelete={() => handleDelete(value)}
                                    onMouseDown={(event) =>
                                        event.stopPropagation()
                                    }
                                    size="small" // Optional: makes them fit better
                                />
                            ))}
                    </Box>
                )}
                value={encodedSelectedRoomIds}
            >
                {Object.values(rooms).map((room) => (
                    <MenuItem
                        key={roomLikeToResourceKey(room)}
                        value={JSON.stringify(roomToResolvable(room))}
                    >
                        {room.name}
                    </MenuItem>
                ))}
            </Select>
        </FormControl>
    );
}
