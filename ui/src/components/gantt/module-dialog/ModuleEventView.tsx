import DeleteIcon from "@mui/icons-material/Delete";
import FormControl from "@mui/material/FormControl";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import TableCell from "@mui/material/TableCell";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import { useSnackbar } from "notistack";
import { useCallback, useState } from "react";

import { enqueueApiErrorSnackbar } from "@/api-client/common";
import {
    GanttEvent,
    GanttEventId,
    GanttModuleId,
    ModuleEventType,
} from "@/api-shared/types/gantt/models";
import { NumberSpinner } from "@/components/base/NumberSpinner";
import { useModuleEventActions } from "@/components/gantt/state/hooks/gantt-funcs/UseModuleEventActions";
import { useEvent } from "@/components/gantt/state/hooks/UseEvent";

function ModuleEventTitle({
    moduleEvent,
    handleCommit,
}: {
    moduleEvent: GanttEvent | undefined;
    handleCommit: (updates: Partial<GanttEvent>) => void;
}) {
    const [localTitle, setLocalTitle] = useState(moduleEvent?.title ?? "");

    return (
        <TextField
            disabled={!moduleEvent}
            fullWidth
            onBlur={() => handleCommit({ title: localTitle })}
            onChange={(e) => setLocalTitle(e.target.value)}
            size="small"
            value={localTitle}
        />
    );
}

export function ModuleEventView({
    moduleId,
    eventId,
}: {
    moduleId: GanttModuleId;
    eventId: GanttEventId;
}) {
    const { enqueueSnackbar } = useSnackbar();
    const moduleEvent = useEvent(eventId);
    const { deleteEvent, updateEvent } = useModuleEventActions();

    const handleCommit = useCallback(
        (updates: Partial<GanttEvent>) => {
            updateEvent(eventId, updates).catch((error) =>
                enqueueApiErrorSnackbar(
                    enqueueSnackbar,
                    "עדכון המופע נכשל!",
                    error,
                ),
            );
        },
        [eventId, updateEvent, enqueueSnackbar],
    );

    const handleDeleteClick = useCallback(() => {
        deleteEvent(moduleId, eventId).catch((error) =>
            enqueueApiErrorSnackbar(
                enqueueSnackbar,
                "מחיקת המופע נכשלה!",
                error,
            ),
        );
    }, [eventId, moduleId, deleteEvent, enqueueSnackbar]);

    return (
        <TableRow>
            <TableCell>
                <ModuleEventTitle
                    handleCommit={handleCommit}
                    key={`${moduleEvent?.title ?? "-title"}`}
                    moduleEvent={moduleEvent}
                />
            </TableCell>
            <TableCell>
                <FormControl disabled={!moduleEvent} fullWidth size="small">
                    <Select
                        onChange={(e) =>
                            handleCommit({
                                type: e.target.value as ModuleEventType,
                            })
                        }
                        value={moduleEvent?.type ?? ModuleEventType.Other}
                    >
                        {(
                            Object.values(
                                ModuleEventType,
                            ) as Array<ModuleEventType>
                        ).map((eventType) => (
                            <MenuItem key={eventType} value={eventType}>
                                {eventType}
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>
            </TableCell>
            <TableCell>
                <FormControl
                    disabled={!moduleEvent}
                    fullWidth
                    size="small"
                    sx={{ m: 0, p: 0 }}
                >
                    <NumberSpinner
                        largeStep={45}
                        onValueChange={(v) =>
                            v ? handleCommit({ minimumDuration: v }) : {}
                        }
                        size="small"
                        step={5}
                        value={moduleEvent?.minimumDuration ?? 0}
                    />
                </FormControl>
            </TableCell>
            <TableCell>
                <IconButton onClick={handleDeleteClick} size="small">
                    <DeleteIcon color="error" fontSize="small" />
                </IconButton>
            </TableCell>
        </TableRow>
    );
}
