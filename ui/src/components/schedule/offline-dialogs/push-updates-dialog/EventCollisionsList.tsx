"use client";

import {
    Checkbox,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TableSortLabel,
    Typography,
} from "@mui/material";
import { Dispatch, SetStateAction, useCallback } from "react";

import { EventListEntry } from "@/components/schedule/offline-dialogs/push-updates-dialog/EventListEntry";
import { CollisionStates } from "@/components/schedule/offline-dialogs/push-updates-dialog/types";
import { EventId } from "@/components/schedule/types/event";

type EventCollisionsListProps = {
    collisionStates: CollisionStates;
    selected: Array<EventId>;
    setSelected: Dispatch<SetStateAction<Array<EventId>>>;
}

export function EventCollisionsList({
    collisionStates,
    selected,
    setSelected,
}: EventCollisionsListProps) {
    const numSelected = selected.length;
    const rowCount = Object.keys(collisionStates).length;

    const onSelectAllClick = useCallback(() => {
        setSelected((oldSelected) => {
            if (oldSelected.length === 0) {
                return Object.keys(collisionStates);
            } else {
                return [];
            }
        });
    }, [collisionStates, setSelected]);

    const handleEntryClick = useCallback(
        (_e: React.MouseEvent<HTMLTableRowElement>, eventId: EventId) => {
            setSelected((oldSelected) => {
                if (oldSelected.includes(eventId)) {
                    return oldSelected.filter((x) => x !== eventId);
                } else {
                    return [...oldSelected, eventId];
                }
            });
        },
        [setSelected],
    );

    const items = Object.keys(collisionStates).map((eventId) => (
        <EventListEntry
            eventId={eventId}
            isItemSelected={selected.includes(eventId)}
            key={eventId}
            {...collisionStates[eventId]}
            handleEntryClick={handleEntryClick}
        />
    ));

    return (
        <TableContainer component={Paper}>
            <Table aria-label="collapsible table">
                <TableHead>
                    <TableRow sx={{ bgcolor: "action.hover" }}>
                        <TableCell width={50} />
                        <TableCell>
                            <Typography fontWeight={600}>מזהה מופע</Typography>
                        </TableCell>
                        <TableCell>
                            <Typography fontWeight={600}>שם</Typography>
                        </TableCell>
                        <TableCell>
                            <TableSortLabel>
                                <Typography fontWeight={600}>קונפליקט?</Typography>
                            </TableSortLabel>
                        </TableCell>
                        <TableCell padding="checkbox">
                            <Checkbox
                                checked={rowCount > 0 && numSelected === rowCount}
                                color="primary"
                                indeterminate={numSelected > 0 && numSelected < rowCount}
                                onChange={onSelectAllClick}
                                slotProps={{
                                    input: {
                                        "aria-label": "select all",
                                    },
                                }}
                            />
                        </TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>{items}</TableBody>
            </Table>
        </TableContainer>
    );
}
