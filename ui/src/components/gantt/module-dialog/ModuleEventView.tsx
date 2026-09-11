import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import DeleteIcon from "@mui/icons-material/Delete";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import DriveFileMoveIcon from "@mui/icons-material/DriveFileMove";
import EditIcon from "@mui/icons-material/Edit";
import FileCopyIcon from "@mui/icons-material/FileCopy";
import FormControl from "@mui/material/FormControl";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import TableCell from "@mui/material/TableCell";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import { useSnackbar } from "notistack";
import { useCallback, useState } from "react";

import
{
    GanttEvent,
    GanttEventId,
    GanttModuleId,
    ModuleEventType,
} from "@/api-shared/types/gantt/models";
import { enqueueApiErrorSnackbar } from "@/components/base/ApiErrorSnackbar";
import { InstructorSelect } from "@/components/base/InstructorSelect";
import { NumberSpinner } from "@/components/base/NumberSpinner";
import { EVENT_ANCHOR_PREFIX } from "@/components/gantt/curriculum-view/search/GanttSearchNavProvider";
import { MoveEventDialog } from "@/components/gantt/module-dialog/MoveEventDialog";
import { useModuleEventActions } from "@/components/gantt/state/hooks/gantt-funcs/UseModuleEventActions";
import { useEvent } from "@/components/gantt/state/hooks/UseEvent";
import { useCurriculumProviderActions, useCurriculumState } from "@/components/gantt/state/provider";

function ModuleEventTitle({
    moduleEvent,
    handleCommit,
}: {
    moduleEvent: GanttEvent | undefined;
    handleCommit: (updates: Partial<GanttEvent>) => void;
})
{
    const [ localTitle, setLocalTitle ] = useState(moduleEvent?.title ?? "");

    return (
        <TextField
            disabled={ !moduleEvent }
            fullWidth
            onBlur={ () => handleCommit({ title: localTitle }) }
            onChange={ (e) => setLocalTitle(e.target.value) }
            size="small"
            value={ localTitle }
        />
    );
}

export function ModuleEventView({
    moduleId,
    eventId,
    isHighlighted = false,
}: {
    moduleId: GanttModuleId;
    eventId: GanttEventId;
    isHighlighted?: boolean;
})
{
    const { enqueueSnackbar } = useSnackbar();
    const moduleEvent = useEvent(eventId);
    const { deleteEvent, updateEvent, duplicateEvent } = useModuleEventActions();
    const { openEventDialog } = useCurriculumProviderActions();
    const state = useCurriculumState();
    const [ moveDialogOpen, setMoveDialogOpen ] = useState(false);

    const handleEditClick = useCallback(() =>
    {
        const syllabusId = state.modules[ moduleId ]?.syllabusId;
        if (!syllabusId) return;
        openEventDialog(syllabusId, moduleId, eventId);
    }, [ state.modules, moduleId, eventId, openEventDialog ]);

    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: eventId });

    const handleCommit = useCallback(
        (updates: Partial<GanttEvent>) =>
        {
            updateEvent(eventId, updates).catch((error) =>
                enqueueApiErrorSnackbar(
                    enqueueSnackbar,
                    "עדכון המופע נכשל!",
                    error,
                ),
            );
        },
        [ eventId, updateEvent, enqueueSnackbar ],
    );

    const handleDeleteClick = useCallback(() =>
    {
        deleteEvent(moduleId, eventId).catch((error) =>
            enqueueApiErrorSnackbar(
                enqueueSnackbar,
                "מחיקת המופע נכשלה!",
                error,
            ),
        );
    }, [ eventId, moduleId, deleteEvent, enqueueSnackbar ]);

    const handleDuplicateClick = useCallback(() =>
    {
        duplicateEvent(eventId, moduleId).catch((error) =>
            enqueueApiErrorSnackbar(
                enqueueSnackbar,
                "שכפול המופע נכשל!",
                error,
            ),
        );
    }, [ eventId, moduleId, duplicateEvent, enqueueSnackbar ]);

    return (
        <TableRow
            id={ `${EVENT_ANCHOR_PREFIX}${eventId}` }
            ref={ setNodeRef }
            style={ {
                transform: CSS.Transform.toString(transform),
                transition,
                opacity: isDragging ? 0.4 : 1,
            } }
            sx={ {
                transition: "background-color 0.4s ease",
                ...(isHighlighted && {
                    backgroundColor: "primary.light",
                    "& .MuiTableCell-root": {
                        backgroundColor: "transparent",
                    },
                }),
            } }
        >
            <TableCell sx={ { width: "1rem", pr: 0, cursor: "grab" } } { ...attributes } { ...listeners }>
                <DragIndicatorIcon fontSize="small" sx={ { color: "text.disabled", display: "block" } } />
            </TableCell>
            <TableCell>
                <ModuleEventTitle
                    handleCommit={ handleCommit }
                    key={ `${moduleEvent?.title ?? "-title"}` }
                    moduleEvent={ moduleEvent }
                />
            </TableCell>
            <TableCell>
                <FormControl disabled={ !moduleEvent } fullWidth size="small">
                    <Select
                        onChange={ (e) =>
                            handleCommit({
                                type: e.target.value as ModuleEventType,
                            })
                        }
                        value={ moduleEvent?.type ?? ModuleEventType.Other }
                    >
                        { (
                            Object.values(
                                ModuleEventType,
                            ) as Array<ModuleEventType>
                        ).map((eventType) => (
                            <MenuItem key={ eventType } value={ eventType }>
                                { eventType }
                            </MenuItem>
                        )) }
                    </Select>
                </FormControl>
            </TableCell>
            <TableCell>
                <FormControl
                    disabled={ !moduleEvent }
                    fullWidth
                    size="small"
                    sx={ { m: 0, p: 0 } }
                >
                    <NumberSpinner
                        largeStep={ 45 }
                        onValueChange={ (v) =>
                            v ? handleCommit({ minimumDuration: v }) : {}
                        }
                        size="small"
                        step={ 5 }
                        value={ moduleEvent?.minimumDuration ?? 0 }
                    />
                </FormControl>
            </TableCell>
            <TableCell>
                <FormControl disabled={ !moduleEvent } fullWidth size="small" sx={ { minWidth: '6rem' } }>
                    <InstructorSelect<"" | number>
                        excludeTeachers
                        onChange={ (e) =>
                            handleCommit({
                                orchestratorId:
                                    e.target.value === ""
                                        ? null
                                        : Number(e.target.value),
                            })
                        }
                        value={ moduleEvent?.orchestratorId ?? "" }
                    >
                        <MenuItem value="">
                            <em>ללא אחראי</em>
                        </MenuItem>
                    </InstructorSelect>
                </FormControl>
            </TableCell>
            <TableCell>
                <IconButton onClick={ handleEditClick } size="small" title="עריכת המופע">
                    <EditIcon color="primary" fontSize="small" />
                </IconButton>
                <IconButton onClick={ handleDuplicateClick } size="small" title="שכפול המופע">
                    <FileCopyIcon color="info" fontSize="small" />
                </IconButton>
                <IconButton onClick={ () => setMoveDialogOpen(true) } size="small" title="העבר מופע למערך אחר">
                    <DriveFileMoveIcon color="action" fontSize="small" />
                </IconButton>
                <IconButton onClick={ handleDeleteClick } size="small" title="מחיקת המופע">
                    <DeleteIcon color="error" fontSize="small" />
                </IconButton>
            </TableCell>
            <MoveEventDialog
                currentModuleId={ moduleId }
                eventId={ eventId }
                onClose={ () => setMoveDialogOpen(false) }
                open={ moveDialogOpen }
            />
        </TableRow>
    );
}
