import MeetingRoomIcon from "@mui/icons-material/MeetingRoom";
import { useMemo } from "react";

import { Room } from "@/api-shared/types/room";
import
{
    ListCard
} from "@/components/settings-dialog/tabs/global/common";
import { SettingsListCardContent } from "@/components/settings-dialog/tabs/global/common/ListCard";
import { RoomListItem } from "@/components/settings-dialog/tabs/global/room-settings/RoomListItem";

export const RoomListCard: ListCard<Room> = function RoomListCard({
    filteredEntities: filteredRooms,
    searchQuery,
    setSearchQuery,
    selectedEntity: selectedRoom,
    populateFormFrom: populateFormFromRoom,
    handleStartCreate,
    handleDelete,
})
{
    const roomItems = useMemo(() => filteredRooms.map((room) =>
    {
        const isActive =
            selectedRoom?.id === room.id &&
            selectedRoom?.source === room.source;

        return (
            <RoomListItem
                isActive={ isActive }
                key={ `${room.source}-${room.id}` }
                onDelete={ handleDelete }
                onPopulateForm={ populateFormFromRoom }
                room={ room }
            />
        );
    }
    ), [
        filteredRooms,
        selectedRoom,
        handleDelete,
        populateFormFromRoom,
        searchQuery,
    ]);

    return (
        <SettingsListCardContent
            addButtonLabel="הוספת חדר מותאם אישית"
            handleStartCreate={ handleStartCreate }
            headerProps={ {
                icon: MeetingRoomIcon,
                subtitle: "ניהול חדרים מהייב וחדרים מותאמים אישית",
                title: "כל החדרים",
            } }
            items={ roomItems }
            searchMessages={ {
                noMatches: "לא נמצאו חדרים התואמים את החיפוש",
                noEntries: "לא הוגדרו חדרים",
            } }
            searchPlaceholder="חיפוש חדר..."
            searchQuery={ searchQuery }
            setSearchQuery={ setSearchQuery }
        />
    );
};
