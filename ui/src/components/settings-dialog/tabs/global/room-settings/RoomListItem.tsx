import ComputerIcon from "@mui/icons-material/Computer";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import EventSeatIcon from "@mui/icons-material/EventSeat";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import useTheme from "@mui/material/useTheme";
import { useCallback } from "react";

import { Room, RoomSource } from "@/api-shared/types/room";
import { HiveLogo } from "@/components/base/HiveLogo";
import { RoomExtendedInfoChip } from "@/components/settings-dialog/tabs/global/room-settings/RoomExtendedInfoChip";

type RoomListItemProps = {
    room: Room;
    isActive: boolean;
    onPopulateForm: (room: Room) => void;
    onDelete: (roomId: string) => void;
};

export function RoomListItem({
    room,
    isActive,
    onPopulateForm,
    onDelete,
}: RoomListItemProps) {
    const theme = useTheme();
    const isHive = room.source === RoomSource.Hive;
    const ext = room.extendedInfo;

    const hiveLogoColor =
        theme.palette.mode === "light" ? "#000000" : "#ffffff";
    const hasSecondaryContent = Boolean(room.description || ext);

    const handlePopulate = useCallback(
        (e: React.MouseEvent) => {
            e.stopPropagation();
            onPopulateForm(room);
        },
        [room, onPopulateForm],
    );

    const handleDelete = useCallback(
        (e: React.MouseEvent) => {
            e.stopPropagation();
            onDelete(room.id as string);
        },
        [room.id, onDelete],
    );

    return (
        <ListItem
            onClick={() => onPopulateForm(room)}
            secondaryAction={
                <Box alignItems="center" display="flex" gap={0.5}>
                    <Tooltip title="ערוך פרטים מורחבים">
                        <IconButton
                            edge="end"
                            onClick={handlePopulate}
                            size="small"
                            sx={{
                                color: "text.secondary",
                                "&:hover": { color: "primary.main" },
                            }}
                        >
                            <EditIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                    {!isHive && (
                        <Tooltip title="מחק">
                            <IconButton
                                edge="end"
                                onClick={handleDelete}
                                size="small"
                                sx={{
                                    color: "text.secondary",
                                    "&:hover": { color: "error.main" },
                                }}
                            >
                                <DeleteIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
                    )}
                    {isHive ? (
                        <Tooltip title="חדר הייב">
                            <Box
                                sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    mr: 0.5,
                                    color: hiveLogoColor,
                                }}
                            >
                                <HiveLogo size={18} />
                            </Box>
                        </Tooltip>
                    ) : null}
                </Box>
            }
            sx={{
                border: "1px solid",
                borderColor: isActive ? "primary.main" : "divider",
                borderRadius: "8px",
                mb: 1,
                p: 1,
                cursor: "pointer",
                bgcolor: isActive
                    ? "action.selected"
                    : theme.palette.mode === "light"
                        ? "rgba(0,0,0,0.01)"
                        : "rgba(255,255,255,0.01)",
                transition: "all 0.2s ease",
                "&:hover": {
                    borderColor: isActive ? "primary.main" : "text.secondary",
                    transform: "translateY(-1px)",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.03)",
                },
            }}
        >
            <ListItemText
                disableTypography
                primary={
                    <Box alignItems="center" display="flex" gap={1}>
                        <Typography
                            component="span"
                            sx={{
                                fontWeight: 700,
                                fontSize: "0.9rem",
                                fontFamily: "Assistant, sans-serif",
                                color: "text.primary",
                            }}
                        >
                            {room.name}
                        </Typography>
                        {isHive ? (
                            <Chip
                                icon={<HiveLogo size={12} />}
                                label="הייב"
                                size="small"
                                sx={{
                                    height: 20,
                                    fontSize: "0.65rem",
                                    fontWeight: 700,
                                    borderRadius: "6px",
                                    color: hiveLogoColor,
                                    borderColor:
                                        theme.palette.mode === "light"
                                            ? "rgba(0,0,0,0.2)"
                                            : "rgba(255,255,255,0.2)",
                                    "& .MuiChip-icon": {
                                        ml: 0.3,
                                        color: hiveLogoColor,
                                    },
                                }}
                                variant="outlined"
                            />
                        ) : null}
                    </Box>
                }
                secondary={
                    hasSecondaryContent ? (
                        <Box
                            display="flex"
                            flexDirection="column"
                            gap={0.5}
                            mt={0.5}
                        >
                            {room.description ? (
                                <Typography
                                    component="span"
                                    sx={{
                                        fontSize: "0.75rem",
                                        fontFamily: "Assistant, sans-serif",
                                        color: "text.secondary",
                                    }}
                                >
                                    {room.description}
                                </Typography>
                            ) : null}
                            {ext ? (
                                <Box display="flex" flexWrap="wrap" gap={0.5}>
                                    {ext.workstationCount !== null && (
                                        <RoomExtendedInfoChip
                                            iconNode={
                                                <ComputerIcon
                                                    sx={{
                                                        fontSize:
                                                            "0.7rem !important",
                                                    }}
                                                />
                                            }
                                            label={`${ext.workstationCount} עמדות`}
                                        />
                                    )}
                                    {ext.lectureSeatCount !== null && (
                                        <RoomExtendedInfoChip
                                            iconNode={
                                                <EventSeatIcon
                                                    sx={{
                                                        fontSize:
                                                            "0.7rem !important",
                                                    }}
                                                />
                                            }
                                            label={`${ext.lectureSeatCount} כסאות`}
                                        />
                                    )}
                                    {ext.lectureComfortable ? (
                                        <RoomExtendedInfoChip
                                            color="success"
                                            label="נוח להרצאה ✓"
                                        />
                                    ) : null}
                                </Box>
                            ) : null}
                        </Box>
                    ) : null
                }
                sx={{ my: 0 }}
            />
        </ListItem>
    );
}
