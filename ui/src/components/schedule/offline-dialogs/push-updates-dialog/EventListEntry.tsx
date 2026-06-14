"use client";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import Checkbox from "@mui/material/Checkbox";
import Collapse from "@mui/material/Collapse";
import IconButton from "@mui/material/IconButton";
import TableCell from "@mui/material/TableCell";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import { Fragment, useState } from "react";

import { DiffDetailsTable } from "@/components/schedule/offline-dialogs/push-updates-dialog/DiffDetailsTable";
import { Event, EventId } from "@/components/schedule/types/event";

type EventListEntryProps = {
    isItemSelected: boolean;
    handleEntryClick: (
        event: React.MouseEvent<HTMLTableRowElement>,
        entryId: EventId,
    ) => void;
    eventId: EventId;
    localModifiedEvent: Event | undefined;
    serverVersion: Event | undefined;
    capturedVersion: Event | undefined;
    conflicting: boolean;
};

export function EventListEntry({
    isItemSelected,
    handleEntryClick,
    eventId,
    localModifiedEvent,
    serverVersion,
    capturedVersion,
    conflicting,
}: EventListEntryProps) {
    const [expanded, setExpanded] = useState<boolean>(false);

    return (
        <Fragment>
            <TableRow
                aria-checked={isItemSelected}
                hover
                onClick={(e) => handleEntryClick(e, eventId)}
                role="checkbox"
                selected={isItemSelected}
                sx={{ "& > *": { borderBottom: "unset" }, cursor: "pointer" }}
            >
                <TableCell>
                    <IconButton
                        aria-label="expand row"
                        onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            setExpanded((v) => !v);
                        }}
                        size="small"
                    >
                        {expanded ? (
                            <KeyboardArrowUpIcon />
                        ) : (
                            <KeyboardArrowDownIcon />
                        )}
                    </IconButton>
                </TableCell>
                <TableCell component="th" scope="row">
                    <Typography fontWeight={500}>{eventId}</Typography>
                </TableCell>
                <TableCell>
                    <Typography>
                        {localModifiedEvent?.name ??
                            serverVersion?.name ??
                            capturedVersion?.name ??
                            "מופע חדש"}
                    </Typography>
                </TableCell>
                <TableCell>
                    <Typography
                        color={conflicting ? "error.main" : "success.main"}
                        sx={{ fontWeight: 600 }}
                    >
                        {conflicting ? "קונפליקט!" : "אין"}
                    </Typography>
                </TableCell>
                <TableCell padding="checkbox">
                    <Checkbox checked={isItemSelected} color="primary" />
                </TableCell>
            </TableRow>
            <TableRow>
                <TableCell
                    colSpan={5}
                    style={{ paddingBottom: 0, paddingTop: 0 }}
                >
                    <Collapse in={expanded} timeout="auto" unmountOnExit>
                        <DiffDetailsTable
                            capturedVersion={capturedVersion}
                            eventId={eventId}
                            localModifiedEvent={localModifiedEvent}
                            serverVersion={serverVersion}
                        />
                    </Collapse>
                </TableCell>
            </TableRow>
        </Fragment>
    );
}
