"use client";

import Box from "@mui/material/Box";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import { useMemo } from "react";

import {
    DeletedItemPlaceholder,
    EmptyValuePlaceholder,
} from "@/components/schedule/offline-dialogs/push-updates-dialog/DeletedItemPlaceholder";
import {
    areDiffValuesEqual,
    formatDateTimeChangeNote,
    formatValue,
    KEY_TRANSLATIONS,
} from "@/components/schedule/offline-dialogs/push-updates-dialog/utils";
import { Event, EventId } from "@/components/schedule/types/event";

type DiffDetailsTableProps = {
    eventId: EventId;
    localModifiedEvent: Event | undefined;
    capturedVersion: Event | undefined;
    serverVersion: Event | undefined;
};

export function DiffDetailsTable({
    eventId,
    localModifiedEvent,
    capturedVersion,
    serverVersion,
}: DiffDetailsTableProps) {
    // Collect all unique event keys, ignoring MongoDB internal "_id". Filter
    // the raw strings first — "_id" isn't part of the Event type, so
    // comparing it after casting to keyof Event needed an `as any` escape
    // hatch to even compile.
    const allKeys = useMemo(() => {
        const keys = new Set([
            ...Object.keys(localModifiedEvent ?? {}),
            ...Object.keys(serverVersion ?? {}),
            ...Object.keys(capturedVersion ?? {}),
        ]);
        keys.delete("_id");
        return [...keys] as Array<keyof Event>;
    }, [localModifiedEvent, serverVersion, capturedVersion]);

    const changeItems = useMemo(() => {
        return allKeys
            .filter((key) => {
                const hasLocalDiff =
                    (localModifiedEvent !== undefined &&
                        capturedVersion !== undefined &&
                        !areDiffValuesEqual(
                            localModifiedEvent[key],
                            capturedVersion[key],
                        )) ||
                    (localModifiedEvent !== undefined &&
                        capturedVersion === undefined) ||
                    (localModifiedEvent === undefined &&
                        capturedVersion !== undefined);
                const hasServerDiff =
                    (serverVersion !== undefined &&
                        capturedVersion !== undefined &&
                        !areDiffValuesEqual(
                            serverVersion[key],
                            capturedVersion[key],
                        )) ||
                    (serverVersion !== undefined &&
                        capturedVersion === undefined) ||
                    (serverVersion === undefined &&
                        capturedVersion !== undefined);
                const hasLocalServerDiff =
                    (localModifiedEvent !== undefined &&
                        serverVersion !== undefined &&
                        !areDiffValuesEqual(
                            localModifiedEvent[key],
                            serverVersion[key],
                        )) ||
                    (localModifiedEvent !== undefined &&
                        serverVersion === undefined) ||
                    (localModifiedEvent === undefined &&
                        serverVersion !== undefined);

                return hasLocalDiff || hasServerDiff || hasLocalServerDiff;
            })
            .map((key) => {
                const localValue = localModifiedEvent?.[key];
                const capturedValue = capturedVersion?.[key];
                const serverValue = serverVersion?.[key];

                // A field has a conflict if server value differs from captured AND local value differs from captured
                const isFieldConflicting =
                    !areDiffValuesEqual(serverValue, capturedValue) &&
                    !areDiffValuesEqual(localValue, capturedValue);

                // For startTime/endTime, surface a human-readable "moved from X to Y" note
                const isDateTimeKey = key === "startTime" || key === "endTime";
                const localChangeNote = isDateTimeKey
                    ? formatDateTimeChangeNote(capturedValue, localValue)
                    : null;
                const serverChangeNote = isDateTimeKey
                    ? formatDateTimeChangeNote(capturedValue, serverValue)
                    : null;

                return (
                    <TableRow
                        key={`${eventId}-${key}`}
                        sx={{
                            bgcolor: isFieldConflicting
                                ? "rgba(239, 68, 68, 0.04)"
                                : "inherit",
                            "&:hover": {
                                bgcolor: isFieldConflicting
                                    ? "rgba(239, 68, 68, 0.08) !important"
                                    : "action.hover",
                            },
                        }}
                    >
                        <TableCell>
                            <Box alignItems="center" display="flex" gap={1}>
                                <Typography fontWeight={500}>
                                    {KEY_TRANSLATIONS[key] ?? key}
                                </Typography>
                                {isFieldConflicting ? (
                                    <Box
                                        sx={{
                                            bgcolor: "error.light",
                                            color: "error.contrastText",
                                            px: 1,
                                            py: 0.25,
                                            borderRadius: 1,
                                            fontSize: "0.7rem",
                                            fontWeight: 600,
                                            userSelect: "none",
                                            display: "inline-block",
                                        }}
                                    >
                                        קונפליקט
                                    </Box>
                                ) : null}
                            </Box>
                        </TableCell>
                        <TableCell>
                            {localModifiedEvent === undefined ? (
                                <DeletedItemPlaceholder />
                            ) : localModifiedEvent[key] !== undefined ? (
                                <>
                                    <Typography>
                                        {formatValue(localModifiedEvent[key], key)}
                                    </Typography>
                                    {localChangeNote ? (
                                        <Typography
                                            color="text.secondary"
                                            variant="caption"
                                        >
                                            {localChangeNote}
                                        </Typography>
                                    ) : null}
                                </>
                            ) : (
                                <EmptyValuePlaceholder />
                            )}
                        </TableCell>
                        <TableCell>
                            {capturedVersion === undefined ? (
                                <DeletedItemPlaceholder />
                            ) : capturedVersion[key] !== undefined ? (
                                <Typography color="text.secondary">
                                    {formatValue(capturedVersion[key], key)}
                                </Typography>
                            ) : (
                                <EmptyValuePlaceholder />
                            )}
                        </TableCell>
                        <TableCell>
                            {serverVersion === undefined ? (
                                <DeletedItemPlaceholder />
                            ) : serverVersion[key] !== undefined ? (
                                <>
                                    <Typography>
                                        {formatValue(serverVersion[key], key)}
                                    </Typography>
                                    {serverChangeNote ? (
                                        <Typography
                                            color="text.secondary"
                                            variant="caption"
                                        >
                                            {serverChangeNote}
                                        </Typography>
                                    ) : null}
                                </>
                            ) : (
                                <EmptyValuePlaceholder />
                            )}
                        </TableCell>
                    </TableRow>
                );
            });
    }, [allKeys, eventId, localModifiedEvent, capturedVersion, serverVersion]);

    return (
        <Box sx={{ margin: 1 }}>
            <Typography
                component="div"
                gutterBottom
                sx={{ fontWeight: 600 }}
                variant="h6"
            >
                פרטי השינויים
            </Typography>
            <Table aria-label="changes-diff" size="small" sx={{ mb: 1 }}>
                <TableHead>
                    <TableRow sx={{ bgcolor: "action.hover" }}>
                        <TableCell>
                            <Typography fontWeight={600}>שם השדה</Typography>
                        </TableCell>
                        <TableCell>
                            <Typography fontWeight={600}>השינוי שלך</Typography>
                        </TableCell>
                        <TableCell>
                            <Typography fontWeight={600}>
                                מה שראית לפני ששינית
                            </Typography>
                        </TableCell>
                        <TableCell>
                            <Typography fontWeight={600}>
                                מה שיש כרגע בשרת
                            </Typography>
                        </TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>{changeItems}</TableBody>
            </Table>
        </Box>
    );
}
