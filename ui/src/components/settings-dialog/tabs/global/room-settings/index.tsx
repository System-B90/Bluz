import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import
{
    CustomRoom,
    Room,
    RoomSource,
} from "@/api-shared/types/room";
import { useRooms } from "@/components/base/RoomsProvider";
import { SettingsTab } from "@/components/settings-dialog/tabs/global/common";
import { useEntityForm } from "@/components/settings-dialog/tabs/global/common/UseEntityForm";
import { RoomFormCard, RoomFormCardProps } from "@/components/settings-dialog/tabs/global/room-settings/RoomFormCard";
import { RoomListCard } from "@/components/settings-dialog/tabs/global/room-settings/RoomListCard";
import {
    EMPTY_ROOM_VALUES,
    roomToValues,
    RoomValues,
    roomValuesToExtendedInfo,
    validateRoom,
} from "@/components/settings-dialog/tabs/global/room-settings/values";

export function RoomSettings()
{
    const { rooms, isLoading, addRoom, updateRoom, deleteRoom, updateRoomExtendedInfo } =
        useRooms();
    const router = useRouter();
    const searchParams = useSearchParams();

    const [ searchQuery, setSearchQuery ] = useState("");
    // Tracked alongside the form so `validate` knows whether the name is
    // required: Hive rooms submit extended info only.
    const [ editingHiveRoom, setEditingHiveRoom ] = useState(false);

    const setRoomParam = useCallback((roomId: null | string) =>
    {
        const params = new URLSearchParams(searchParams.toString());
        if (roomId)
        {
            params.set("editRoom", roomId);
        } else
        {
            params.delete("editRoom");
        }
        router.replace(`?${params.toString()}`, { scroll: false });
    }, [ router, searchParams ]);

    const toValues = useCallback((room: Room) =>
    {
        setEditingHiveRoom(room.source !== RoomSource.Custom);
        return roomToValues(room);
    }, []);

    const validate = useCallback(
        (values: RoomValues) => validateRoom(values, !editingHiveRoom),
        [ editingHiveRoom ],
    );

    const onCreate = useCallback(
        (values: RoomValues) => addRoom({
            name: values.name.trim(),
            description: values.description.trim() || null,
            extendedInfo: roomValuesToExtendedInfo(values),
        }),
        [ addRoom ],
    );

    const onUpdate = useCallback(
        async (room: Room, values: RoomValues) =>
        {
            const extendedInfo = roomValuesToExtendedInfo(values);

            // A Hive room's name and description are owned upstream, so only
            // its extended info is writable from here.
            if (room.source !== RoomSource.Custom)
            {
                await updateRoomExtendedInfo(room.id, room.source, extendedInfo);
                return;
            }

            await updateRoom({
                ...room,
                name: values.name.trim(),
                description: values.description.trim() || null,
                extendedInfo,
            } as CustomRoom);
            await updateRoomExtendedInfo(room.id, room.source, extendedInfo);
        },
        [ updateRoom, updateRoomExtendedInfo ],
    );

    const form = useEntityForm<Room, RoomValues>({
        confirmDeleteMessage: () => "האם אתה בטוח שברצונך למחוק חדר זה?",
        emptyValues: EMPTY_ROOM_VALUES,
        errorMessages: {
            create: "שגיאה ביצירת חדר מותאם אישית",
            delete: "שגיאה במחיקת חדר",
            update: "שגיאה בעדכון חדר",
        },
        onCreate,
        onDelete: deleteRoom,
        onSelectionChange: setRoomParam,
        onUpdate,
        toValues,
        validate,
    });

    const { populateFormState, selectedEntity } = form;

    useEffect(() =>
    {
        const roomId = searchParams.get("editRoom");
        if (!roomId || rooms.length === 0) return;
        const room = rooms.find((r) => r.id === roomId);
        if (room && (!selectedEntity || selectedEntity.id !== roomId))
        {
            queueMicrotask(() => populateFormState(room));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps -- selectedEntity intentionally excluded to avoid set→rerun loop
    }, [ rooms, searchParams ]);

    const filteredRooms = useMemo(() =>
    {
        const query = searchQuery.trim().toLowerCase();
        if (!query) return rooms;
        return rooms.filter(
            (r) =>
                r.name.toLowerCase().includes(query) ||
                (r.description && r.description.toLowerCase().includes(query)),
        );
    }, [ rooms, searchQuery ]);

    return (
        <>
            <SettingsTab<Room, RoomFormCardProps>
                FormCard={ RoomFormCard }
                formCardProps={ {
                    handleCancelEdit: form.handleCancelEdit,
                    handleSave: form.handleSave,
                    isCreating: form.isCreating,
                    setValue: form.setValue,
                    values: form.values,
                } }
                ListCard={ RoomListCard }
                listCardProps={ {
                    filteredEntities: filteredRooms,
                    isLoading,
                    handleDelete: form.handleDelete,
                    handleStartCreate: form.handleStartCreate,
                    populateFormFrom: form.populateFormFrom,
                    searchQuery,
                    setSearchQuery,
                } }
                selectedEntity={ selectedEntity }
            />
            { form.confirmDialog }
        </>
    );
}
