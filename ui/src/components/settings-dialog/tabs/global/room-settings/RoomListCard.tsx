import AddIcon from "@mui/icons-material/Add";
import SearchIcon from "@mui/icons-material/Search";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import InputAdornment from "@mui/material/InputAdornment";
import List from "@mui/material/List";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useMemo } from "react";

import { Room } from "@/api-shared/types/room";
import { RoomListHeader } from "@/components/settings-dialog/tabs/global/room-settings/RoomListHeader";
import { RoomListItem } from "@/components/settings-dialog/tabs/global/room-settings/RoomListItem";

type RoomListCardProps = {
    filteredRooms: Array<Room>;
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    selectedRoom: null | Room;
    populateFormFromRoom: (room: Room) => void;
    handleStartCreate: () => void;
    handleDelete: (roomId: string) => Promise<void>;
};

export function RoomListCard({
    filteredRooms,
    searchQuery,
    setSearchQuery,
    selectedRoom,
    populateFormFromRoom,
    handleStartCreate,
    handleDelete,
}: RoomListCardProps) {
    const roomItems = useMemo(() => {
        return filteredRooms.length === 0 ? (
            <Box
                sx={{
                    m: "auto",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 1,
                }}
            >
                <Typography
                    sx={{
                        color: "text.secondary",
                        fontSize: "0.85rem",
                    }}
                >
                    {searchQuery
                        ? "לא נמצאו חדרים התואמים את החיפוש"
                        : "לא הוגדרו חדרים"}
                </Typography>
            </Box>
        ) : (
            <List disablePadding>
                {filteredRooms.map((room) => {
                    const isActive =
                        selectedRoom?.id === room.id &&
                        selectedRoom?.source === room.source;

                    return (
                        <RoomListItem
                            isActive={isActive}
                            key={`${room.source}-${room.id}`}
                            onDelete={handleDelete}
                            onPopulateForm={populateFormFromRoom}
                            room={room}
                        />
                    );
                })}
            </List>
        );
    }, [
        filteredRooms,
        selectedRoom,
        handleDelete,
        populateFormFromRoom,
        searchQuery,
    ]);

    return (
        <Box
            sx={{
                flex: 1.4,
                minWidth: 0,
                border: "1px solid",
                borderColor: "divider",
                borderRadius: "16px",
                p: 3,
                boxShadow: (theme) =>
                    theme.palette.mode === "light"
                        ? `0 8px 24px rgb(${theme.vars.palette.primary.mainChannel} / 0.04)`
                        : "0 8px 24px rgba(0, 0, 0, 0.2)",
                bgcolor: "background.paper",
                display: "flex",
                flexDirection: "column",
                gap: 2.5,
            }}
        >
            <RoomListHeader />

            <TextField
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="חפש חדר..."
                size="small"
                slotProps={{
                    input: {
                        startAdornment: (
                            <InputAdornment position="start">
                                <SearchIcon
                                    fontSize="small"
                                    sx={{ color: "text.secondary" }}
                                />
                            </InputAdornment>
                        ),
                    },
                }}
                sx={{
                    "& .MuiOutlinedInput-root": {
                        borderRadius: "10px",
                    },
                }}
                value={searchQuery}
            />

            <Box
                sx={{
                    maxHeight: 340,
                    overflowY: "auto",
                    pr: 0.5,
                    pt: 2,
                    mt: -2,
                    display: "flex",
                    flexDirection: "column",
                    gap: 0.5,
                    minHeight: 180,
                }}
            >
                {roomItems}
            </Box>

            <Button
                color="secondary"
                onClick={handleStartCreate}
                startIcon={<AddIcon className="ml-1" />}
                sx={{
                    borderRadius: "10px",
                    py: 1,
                    fontWeight: 700,
                    fontSize: "0.82rem",
                    boxShadow: "0 4px 12px rgb(var(--mui-palette-secondary-mainChannel) / 0.1)",
                    transition: "all 0.2s ease",
                    "&:hover": {
                        transform: "translateY(-1px)",
                        boxShadow: "0 6px 16px rgb(var(--mui-palette-secondary-mainChannel) / 0.2)",
                    },
                }}
                variant="contained"
            >
                הוספת חדר מותאם אישית
            </Button>
        </Box>
    );
}
