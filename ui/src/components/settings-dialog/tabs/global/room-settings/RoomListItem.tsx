"use client";

import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
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
import { useCallback, useState } from "react";

import { Room, RoomSource } from "@/api-shared/types/room";
import { HiveLogo } from "@/components/base/HiveLogo";
import { ReservationDialog } from "@/components/settings-dialog/tabs/global/room-settings/reservations/ReservationDialog";
import { RoomExtendedInfoChip } from "@/components/settings-dialog/tabs/global/room-settings/RoomExtendedInfoChip";

type RoomListItemProps = {
    room: Room;
    isActive: boolean;
    onPopulateForm: (room: Room) => void;
    onDelete: (roomId: string) => void;
};
type ActionButtonProps = {
    title: string;
    onClick: (e: React.MouseEvent) => void;
    icon: React.ElementType;
    hoverColor: string;
};

function ActionButton({ title, onClick, icon: Icon, hoverColor }: ActionButtonProps)
{
    return (
        <Tooltip title={ title }>
            <IconButton
                edge="end"
                onClick={ onClick }
                size="small"
                sx={ {
                    color: "text.secondary",
                    "&:hover": { color: hoverColor },
                } }
            >
                <Icon fontSize="small" />
            </IconButton>
        </Tooltip>
    );
}

const EXT_ICON_STYLES = { fontSize: "0.7rem" };

export function RoomListItem({
    room,
    isActive,
    onPopulateForm,
    onDelete,
}: RoomListItemProps)
{
    const [ reservationOpen, setReservationOpen ] = useState(false);

    const isHive = room.source === RoomSource.Hive;
    const ext = room.extendedInfo;

    const handlePopulate = useCallback(
        (e: React.MouseEvent) =>
        {
            e.stopPropagation();
            onPopulateForm(room);
        },
        [ room, onPopulateForm ],
    );

    const handleDelete = useCallback(
        (e: React.MouseEvent) =>
        {
            e.stopPropagation();
            onDelete(room.id as string);
        },
        [ room.id, onDelete ],
    );

    const handleReservationOpen = useCallback((e: React.MouseEvent) =>
    {
        e.stopPropagation();
        setReservationOpen(true);
    }, []);

    return (
        <>
            <ReservationDialog
                onClose={ () => setReservationOpen(false) }
                open={ reservationOpen }
                room={ room }
            />
            <ListItem
                onClick={ () => onPopulateForm(room) }
                secondaryAction={
                    <Box alignItems="center" display="flex" gap={ 0.5 }>
                        <ActionButton
                            hoverColor="primary.main"
                            icon={ CalendarMonthIcon }
                            onClick={ handleReservationOpen }
                            title="הזמנות חדר"
                        />
                        <ActionButton
                            hoverColor="primary.main"
                            icon={ EditIcon }
                            onClick={ handlePopulate }
                            title="ערוך פרטים מורחבים"
                        />
                        { !isHive && (
                            <ActionButton
                                hoverColor="error.main"
                                icon={ DeleteIcon }
                                onClick={ handleDelete }
                                title="מחק"
                            />
                        ) }
                        { isHive ? <Tooltip title="כיתה בהייב">
                            <Box
                                alignItems="center"
                                display="flex"
                                mr={ 0.5 }
                                sx={ { color: "text.secondary" } }
                            >
                                <HiveLogo size={ 18 } />
                            </Box>
                        </Tooltip> : null }
                    </Box>
                }
                sx={ {
                    border: "1px solid",
                    borderColor: isActive ? "primary.main" : "divider",
                    borderRadius: "8px",
                    mb: 1,
                    p: 1,
                    cursor: "pointer",
                    bgcolor: isActive ? "action.selected" : "transparent",
                    transition: "all 0.2s ease",
                    "&:hover": {
                        borderColor: isActive ? "primary.main" : "text.secondary",
                        transform: "translateY(-1px)",
                        boxShadow: "0 4px 12px rgba(0,0,0,0.03)",
                        bgcolor: isActive ? "action.selected" : "action.hover",
                    },
                } }
            >
                <ListItemText
                    disableTypography
                    primary={
                        <Box alignItems="center" display="flex" flexWrap="nowrap" gap={ 1 }>
                            <Typography
                                component="span"
                                sx={ {
                                    fontWeight: 700,
                                    fontSize: "0.9rem",
                                    color: "text.primary",
                                } }
                            >
                                { room.name }
                            </Typography>
                            { isHive ? <Chip
                                icon={ <HiveLogo size={ 12 } /> }
                                label="הייב"
                                size="small"
                                sx={ {
                                    height: 20,
                                    fontSize: "0.65rem",
                                    fontWeight: 700,
                                    borderRadius: "6px",
                                    color: "text.primary",
                                    "& .MuiChip-icon": {
                                        marginInlineEnd: 0,
                                        color: "text.primary",
                                    },
                                } }
                                variant="outlined"
                            /> : null }
                            { ext?.peAyin ? <RoomExtendedInfoChip color="warning" label='כיתת פ"עים' /> : null }
                            { ext?.lectureComfortable ? <RoomExtendedInfoChip color="success" label="נוח להרצאה ✓" /> : null }
                            { ext?.workstationCount != null && (
                                <RoomExtendedInfoChip
                                    iconNode={ <ComputerIcon sx={ EXT_ICON_STYLES } /> }
                                    label={ `${ext.workstationCount} עמדות` }
                                />
                            ) }
                            { ext?.lectureSeatCount != null && (
                                <RoomExtendedInfoChip
                                    iconNode={ <EventSeatIcon sx={ EXT_ICON_STYLES } /> }
                                    label={ `${ext.lectureSeatCount} כסאות` }
                                />
                            ) }
                        </Box>
                    }
                    secondary={
                        room.description ? <Typography
                            component="span"
                            sx={ {
                                fontSize: "0.75rem",
                                color: "text.secondary",
                            } }
                        >
                            { room.description }
                        </Typography> : null
                    }
                    sx={ { my: 0 } }
                />
            </ListItem>
        </>
    );
}
