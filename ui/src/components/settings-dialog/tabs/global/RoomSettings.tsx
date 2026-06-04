"use client";

import AddIcon from "@mui/icons-material/Add";
import ClearIcon from "@mui/icons-material/Clear";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import MeetingRoomIcon from "@mui/icons-material/MeetingRoom";
import SearchIcon from "@mui/icons-material/Search";
import {
    Box,
    Button,
    InputAdornment,
    List,
    ListItem,
    ListItemText,
    TextField,
    Tooltip,
    Typography,
} from "@mui/material";
import IconButton from "@mui/material/IconButton";
import { useSnackbar } from "notistack";
import React, { useMemo, useState } from "react";

import { useRooms } from "@/components/base/RoomsProvider";
import { CustomRoom, RoomSource } from "@/api-shared/types/room";

export function RoomSettings() {
    const { rooms, addRoom, updateRoom, deleteRoom } = useRooms();
    const { enqueueSnackbar } = useSnackbar();

    // Filter to only custom rooms
    const customRooms = useMemo(
        () => rooms.filter((r): r is CustomRoom => r.source === RoomSource.Custom),
        [rooms],
    );

    const [searchQuery, setSearchQuery] = useState("");
    const [editingRoom, setEditingRoom] = useState<CustomRoom | null>(null);
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");

    const filteredRooms = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        if (!query) return customRooms;
        return customRooms.filter(
            (r) =>
                r.name.toLowerCase().includes(query) ||
                (r.description && r.description.toLowerCase().includes(query)),
        );
    }, [customRooms, searchQuery]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmedName = name.trim();
        if (!trimmedName) {
            enqueueSnackbar("שם החדר הוא שדה חובה", { variant: "warning" });
            return;
        }

        try {
            if (editingRoom) {
                await updateRoom({
                    ...editingRoom,
                    name: trimmedName,
                    description: description.trim() || null,
                });
                setEditingRoom(null);
            } else {
                await addRoom({
                    name: trimmedName,
                    description: description.trim() || null,
                });
            }
            setName("");
            setDescription("");
        } catch (err) {
            console.error(err);
        }
    };

    const handleEdit = (room: CustomRoom) => {
        setEditingRoom(room);
        setName(room.name);
        setDescription(room.description || "");
    };

    const handleCancelEdit = () => {
        setEditingRoom(null);
        setName("");
        setDescription("");
    };

    const handleDelete = async (roomId: string) => {
        if (window.confirm("האם אתה בטוח שברצונך למחוק חדר זה?")) {
            try {
                if (editingRoom && editingRoom.id === roomId) {
                    handleCancelEdit();
                }
                await deleteRoom(roomId);
            } catch (err) {
                console.error(err);
            }
        }
    };

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
            {/* Card 1: Room List */}
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
                            ? "0 8px 24px rgba(103, 200, 221, 0.04)"
                            : "0 8px 24px rgba(0, 0, 0, 0.2)",
                    bgcolor: "background.paper",
                    display: "flex",
                    flexDirection: "column",
                    gap: 2.5,
                }}
            >
                {/* Header */}
                <Box alignItems="center" display="flex" gap={1.5}>
                    <Box
                        sx={{
                            p: 1,
                            borderRadius: "10px",
                            bgcolor: "primary.light",
                            color: "primary.contrastText",
                            display: "flex",
                            alignItems: "center",
                        }}
                    >
                        <MeetingRoomIcon sx={{ fontSize: 20 }} />
                    </Box>
                    <Box>
                        <Typography
                            sx={{
                                fontWeight: 800,
                                fontSize: "1.1rem",
                                fontFamily: "Assistant, sans-serif",
                                color: "text.primary",
                            }}
                        >
                            חדרים מותאמים אישית
                        </Typography>
                        <Typography
                            sx={{
                                fontSize: "0.75rem",
                                color: "text.secondary",
                                fontFamily: "Assistant, sans-serif",
                            }}
                        >
                            ניהול חדרים וכיתות לימוד מחוץ למערכת הייב
                        </Typography>
                    </Box>
                </Box>

                {/* Search Bar */}
                <TextField
                    InputProps={{
                        startAdornment: (
                            <InputAdornment position="start">
                                <SearchIcon fontSize="small" sx={{ color: "text.secondary" }} />
                            </InputAdornment>
                        ),
                    }}
                    placeholder="חפש חדר..."
                    size="small"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    sx={{
                        "& .MuiOutlinedInput-root": {
                            borderRadius: "10px",
                        },
                    }}
                />

                {/* Scrollable Room List */}
                <Box
                    sx={{
                        maxHeight: 320,
                        overflowY: "auto",
                        pr: 0.5,
                        display: "flex",
                        flexDirection: "column",
                        gap: 1.5,
                        minHeight: 180,
                    }}
                >
                    {filteredRooms.length === 0 ? (
                        <Box sx={{ m: "auto", display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
                            <Typography sx={{ color: "text.secondary", fontSize: "0.85rem", fontFamily: "Assistant, sans-serif" }}>
                                {searchQuery ? "לא נמצאו חדרים התואמים את החיפוש" : "לא הוגדרו חדרים מותאמים אישית"}
                            </Typography>
                        </Box>
                    ) : (
                        <List disablePadding>
                            {filteredRooms.map((room) => {
                                const isEditing = editingRoom?.id === room.id;
                                return (
                                    <ListItem
                                        key={room.id}
                                        sx={{
                                            border: "1px solid",
                                            borderColor: isEditing ? "primary.main" : "divider",
                                            borderRadius: "12px",
                                            mb: 1.5,
                                            p: 1.5,
                                            bgcolor: (theme) =>
                                                isEditing
                                                    ? "action.selected"
                                                    : theme.palette.mode === "light"
                                                        ? "rgba(0,0,0,0.01)"
                                                        : "rgba(255,255,255,0.01)",
                                            transition: "all 0.2s ease",
                                            "&:hover": {
                                                borderColor: isEditing ? "primary.main" : "text.secondary",
                                                transform: "translateY(-1px)",
                                                boxShadow: "0 4px 12px rgba(0,0,0,0.03)",
                                            },
                                        }}
                                        secondaryAction={
                                            <Box display="flex" gap={0.5}>
                                                <Tooltip title="ערוך">
                                                    <IconButton
                                                        edge="end"
                                                        size="small"
                                                        onClick={() => handleEdit(room)}
                                                        sx={{
                                                            color: "text.secondary",
                                                            "&:hover": { color: "primary.main" },
                                                        }}
                                                    >
                                                        <EditIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                                <Tooltip title="מחק">
                                                    <IconButton
                                                        edge="end"
                                                        size="small"
                                                        onClick={() => handleDelete(room.id)}
                                                        sx={{
                                                            color: "text.secondary",
                                                            "&:hover": { color: "error.main" },
                                                        }}
                                                    >
                                                        <DeleteIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                            </Box>
                                        }
                                    >
                                        <ListItemText
                                            primary={room.name}
                                            secondary={room.description || "אין תיאור לחדר זה"}
                                            primaryTypographyProps={{
                                                fontWeight: 700,
                                                fontSize: "0.9rem",
                                                fontFamily: "Assistant, sans-serif",
                                                color: "text.primary",
                                            }}
                                            secondaryTypographyProps={{
                                                fontSize: "0.75rem",
                                                fontFamily: "Assistant, sans-serif",
                                                color: "text.secondary",
                                            }}
                                        />
                                    </ListItem>
                                );
                            })}
                        </List>
                    )}
                </Box>
            </Box>

            {/* Card 2: Add / Edit Form */}
            <Box
                component="form"
                onSubmit={handleSave}
                sx={{
                    flex: 1,
                    minWidth: 0,
                    border: "1px solid",
                    borderColor: "divider",
                    borderRadius: "16px",
                    p: 3,
                    boxShadow: (theme) =>
                        theme.palette.mode === "light"
                            ? "0 8px 24px rgba(103, 200, 221, 0.04)"
                            : "0 8px 24px rgba(0, 0, 0, 0.2)",
                    bgcolor: "background.paper",
                    display: "flex",
                    flexDirection: "column",
                    gap: 3,
                }}
            >
                {/* Form Title */}
                <Box alignItems="center" display="flex" gap={1.5}>
                    <Box
                        sx={{
                            p: 1,
                            borderRadius: "10px",
                            bgcolor: "secondary.light",
                            color: "secondary.contrastText",
                            display: "flex",
                            alignItems: "center",
                        }}
                    >
                        {editingRoom ? <EditIcon sx={{ fontSize: 20 }} /> : <AddIcon sx={{ fontSize: 20 }} />}
                    </Box>
                    <Box>
                        <Typography
                            sx={{
                                fontWeight: 800,
                                fontSize: "1.1rem",
                                fontFamily: "Assistant, sans-serif",
                                color: "text.primary",
                            }}
                        >
                            {editingRoom ? "עריכת חדר" : "הוספת חדר חדש"}
                        </Typography>
                        <Typography
                            sx={{
                                fontSize: "0.75rem",
                                color: "text.secondary",
                                fontFamily: "Assistant, sans-serif",
                            }}
                        >
                            {editingRoom ? "עדכון פרטי חדר מותאם אישית קיים" : "יצירת חדר מותאם אישית חדש במערכת"}
                        </Typography>
                    </Box>
                </Box>

                {/* Form Fields */}
                <Box display="flex" flexDirection="column" gap={2.5}>
                    <TextField
                        required
                        fullWidth
                        label="שם החדר"
                        placeholder="לדוגמה: כיתת הדרכה 3"
                        size="small"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        sx={{
                            "& .MuiOutlinedInput-root": {
                                borderRadius: "10px",
                            },
                        }}
                    />
                    <TextField
                        fullWidth
                        multiline
                        rows={3}
                        label="תיאור"
                        placeholder="תיאור קצר, מיקום או פרטים נוספים..."
                        size="small"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        sx={{
                            "& .MuiOutlinedInput-root": {
                                borderRadius: "10px",
                            },
                        }}
                    />
                </Box>

                {/* Actions Row */}
                <Box display="flex" gap={1.5} mt={1}>
                    <Button
                        type="submit"
                        color={editingRoom ? "primary" : "secondary"}
                        variant="contained"
                        sx={{
                            flex: 1,
                            borderRadius: "10px",
                            py: 1,
                            fontWeight: 700,
                            fontSize: "0.82rem",
                            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.08)",
                        }}
                    >
                        {editingRoom ? "עדכן חדר" : "צור חדר"}
                    </Button>
                    {editingRoom && (
                        <Button
                            onClick={handleCancelEdit}
                            variant="outlined"
                            color="inherit"
                            startIcon={<ClearIcon />}
                            sx={{
                                borderRadius: "10px",
                                py: 1,
                                fontWeight: 700,
                                fontSize: "0.82rem",
                            }}
                        >
                            ביטול
                        </Button>
                    )}
                </Box>
            </Box>
        </Box>
    );
}
