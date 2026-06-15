import Box from "@mui/material/Box";
import { useSnackbar } from "notistack";
import { useCallback, useMemo, useState } from "react";

import { enqueueApiErrorSnackbar } from "@/api-client/common";
import {
    CustomRoom,
    Room,
    RoomExtendedInfo,
    RoomSource,
} from "@/api-shared/types/room";
import { useRooms } from "@/components/base/RoomsProvider";
import { RoomFormCard } from "@/components/settings-dialog/tabs/global/room-settings/RoomFormCard";
import { RoomListCard } from "@/components/settings-dialog/tabs/global/room-settings/RoomListCard";

const DEFAULT_EXTENDED_INFO: RoomExtendedInfo = {
    workstationCount: null,
    lectureSeatCount: null,
    lectureComfortable: false,
};

export function RoomSettings() {
    const { rooms, addRoom, updateRoom, deleteRoom, updateRoomExtendedInfo } =
        useRooms();
    const { enqueueSnackbar } = useSnackbar();

    const [searchQuery, setSearchQuery] = useState("");
    const [selectedRoom, setSelectedRoom] = useState<null | Room>(null);
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [workstationCount, setWorkstationCount] = useState<string>("");
    const [lectureSeatCount, setLectureSeatCount] = useState<string>("");
    const [lectureComfortable, setLectureComfortable] = useState(false);
    const [isCreating, setIsCreating] = useState(false);

    const filteredRooms = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        if (!query) return rooms;
        return rooms.filter(
            (r) =>
                r.name.toLowerCase().includes(query) ||
                (r.description && r.description.toLowerCase().includes(query)),
        );
    }, [rooms, searchQuery]);

    const populateFormFromRoom = useCallback((room: Room) => {
        setSelectedRoom(room);
        setIsCreating(false);
        setName(room.name);
        setDescription(room.description || "");
        const ext = room.extendedInfo || DEFAULT_EXTENDED_INFO;
        setWorkstationCount(
            ext.workstationCount !== null ? String(ext.workstationCount) : "",
        );
        setLectureSeatCount(
            ext.lectureSeatCount !== null ? String(ext.lectureSeatCount) : "",
        );
        setLectureComfortable(ext.lectureComfortable);
    }, []);

    const handleStartCreate = useCallback(() => {
        setSelectedRoom(null);
        setIsCreating(true);
        setName("");
        setDescription("");
        setWorkstationCount("");
        setLectureSeatCount("");
        setLectureComfortable(false);
    }, []);

    const handleCancelEdit = useCallback(() => {
        setSelectedRoom(null);
        setIsCreating(false);
        setName("");
        setDescription("");
        setWorkstationCount("");
        setLectureSeatCount("");
        setLectureComfortable(false);
    }, []);

    const buildExtendedInfo = useCallback(
        (): RoomExtendedInfo => ({
            workstationCount: workstationCount.trim()
                ? parseInt(workstationCount, 10)
                : null,
            lectureSeatCount: lectureSeatCount.trim()
                ? parseInt(lectureSeatCount, 10)
                : null,
            lectureComfortable,
        }),
        [workstationCount, lectureSeatCount, lectureComfortable],
    );

    const handleSave = useCallback(
        async (e: React.FormEvent) => {
            e.preventDefault();
            const trimmedName = name.trim();

            if (isCreating) {
                if (!trimmedName) {
                    enqueueSnackbar("שם החדר הוא שדה חובה", {
                        variant: "warning",
                    });
                    return;
                }
                try {
                    await addRoom({
                        name: trimmedName,
                        description: description.trim() || null,
                        extendedInfo: buildExtendedInfo(),
                    });
                    handleCancelEdit();
                } catch (err) {
                    enqueueApiErrorSnackbar(
                        enqueueSnackbar,
                        "שגיאה ביצירת חדר מותאם אישית",
                        err,
                    );
                }
                return;
            }

            if (!selectedRoom) return;

            if (selectedRoom.source === RoomSource.Custom) {
                if (!trimmedName) {
                    enqueueSnackbar("שם החדר הוא שדה חובה", {
                        variant: "warning",
                    });
                    return;
                }
                try {
                    await updateRoom({
                        ...selectedRoom,
                        name: trimmedName,
                        description: description.trim() || null,
                        extendedInfo: buildExtendedInfo(),
                    } as CustomRoom);
                    await updateRoomExtendedInfo(
                        selectedRoom.id,
                        selectedRoom.source,
                        buildExtendedInfo(),
                    );
                    handleCancelEdit();
                } catch (err) {
                    enqueueApiErrorSnackbar(
                        enqueueSnackbar,
                        "שגיאה בעדכון חדר מותאם אישית",
                        err,
                    );
                }
            } else {
                try {
                    await updateRoomExtendedInfo(
                        selectedRoom.id,
                        selectedRoom.source,
                        buildExtendedInfo(),
                    );
                    handleCancelEdit();
                } catch (err) {
                    enqueueApiErrorSnackbar(
                        enqueueSnackbar,
                        "שגיאה בעדכון פרטים מורחבים עבור חדר הייב",
                        err,
                    );
                }
            }
        },
        [
            isCreating,
            name,
            description,
            buildExtendedInfo,
            selectedRoom,
            addRoom,
            updateRoom,
            updateRoomExtendedInfo,
            handleCancelEdit,
            enqueueSnackbar,
        ],
    );

    const handleDelete = useCallback(
        async (roomId: string) => {
            if (window.confirm("האם אתה בטוח שברצונך למחוק חדר זה?")) {
                try {
                    if (selectedRoom && selectedRoom.id === roomId) {
                        handleCancelEdit();
                    }
                    await deleteRoom(roomId);
                } catch (err) {
                    enqueueApiErrorSnackbar(
                        enqueueSnackbar,
                        "שגיאה במחיקת חדר",
                        err,
                    );
                }
            }
        },
        [selectedRoom, handleCancelEdit, deleteRoom, enqueueSnackbar],
    );

    return (
        <Box
            sx={{
                display: "flex",
                flexDirection: { xs: "column", lg: "row" },
                gap: 3,
                alignItems: "stretch",
                justifyContent: "center",
                width: "100%",
            }}
        >
            <RoomListCard
                filteredRooms={filteredRooms}
                handleDelete={handleDelete}
                handleStartCreate={handleStartCreate}
                populateFormFromRoom={populateFormFromRoom}
                searchQuery={searchQuery}
                selectedRoom={selectedRoom}
                setSearchQuery={setSearchQuery}
            />

            <RoomFormCard
                description={description}
                handleCancelEdit={handleCancelEdit}
                handleSave={handleSave}
                isCreating={isCreating}
                lectureComfortable={lectureComfortable}
                lectureSeatCount={lectureSeatCount}
                name={name}
                selectedRoom={selectedRoom}
                setDescription={setDescription}
                setLectureComfortable={setLectureComfortable}
                setLectureSeatCount={setLectureSeatCount}
                setName={setName}
                setWorkstationCount={setWorkstationCount}
                workstationCount={workstationCount}
            />
        </Box>
    );
}
