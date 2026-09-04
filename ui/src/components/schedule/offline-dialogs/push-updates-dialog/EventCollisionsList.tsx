"use client";

import Checkbox from "@mui/material/Checkbox";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import { Dispatch, SetStateAction, useCallback } from "react";

import { EventListEntry } from "@/components/schedule/offline-dialogs/push-updates-dialog/EventListEntry";
import { CollisionStates } from "@/components/schedule/offline-dialogs/push-updates-dialog/types";
import { EventId } from "@/components/schedule/types/event";

type EventCollisionsListProps = {
    collisionStates: CollisionStates;
    selected: Array<EventId>;
    setSelected: Dispatch<SetStateAction<Array<EventId>>>;
};

export function EventCollisionsList({
    collisionStates,
    selected,
    setSelected,
}: EventCollisionsListProps) {
    const numSelected = selected.length;
    const rowCount = Object.keys(collisionStates).length;

    const onSelectAllClick = useCallback(() => {
        setSelected((oldSelected) => {
            // A partial selection means "select all", matching the
            // indeterminate checkbox the header renders for it. Treating
            // anything non-empty as "clear all" made the first click on a
            // dialog that opens pre-selected wipe the selection, and
            // submitting then reverted every local edit (#630).
            const allIds = Object.keys(collisionStates);
            return oldSelected.length === allIds.length ? [] : allIds;
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
            <Table aria-label="טבלת מופעים מתנגשים">
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
                            {/* Not sortable — a bare TableSortLabel with no
                                onClick/active prop announced itself as an
                                interactive sort control to screen readers
                                and keyboard users without doing anything. */}
                            <Typography fontWeight={600}>קונפליקט?</Typography>
                        </TableCell>
                        <TableCell padding="checkbox">
                            <Checkbox
                                checked={
                                    rowCount > 0 && numSelected === rowCount
                                }
                                color="primary"
                                indeterminate={
                                    numSelected > 0 && numSelected < rowCount
                                }
                                onChange={onSelectAllClick}
                                slotProps={{
                                    input: {
                                        "aria-label": "בחירת הכל",
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
