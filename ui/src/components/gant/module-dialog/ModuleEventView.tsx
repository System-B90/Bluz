import DeleteIcon from '@mui/icons-material/Delete';
import
    {
        FormControl,
        IconButton,
        MenuItem,
        Select,
        TableCell,
        TableRow,
        TextField
    } from "@mui/material";
import { useCallback, useState } from "react";

import { ModuleEvent, ModuleEventId, ModuleEventType, ModuleId } from "@/api-shared/types/gant/curriculum";
import NumberSpinner from "@/components/base/NumberSpinner";
import { useModuleEventActions } from "@/components/gant/state/hooks/gant-funcs/UseModuleEventActions";
import { useEvent } from '@/components/gant/state/hooks/UseEvent';

function ModuleEventTitle({ moduleEvent, handleCommit }: { moduleEvent: ModuleEvent | undefined; handleCommit: (updates: Partial<ModuleEvent>) => void; })
{
    const [ localTitle, setLocalTitle ] = useState(moduleEvent?.title ?? '');

    return (
        <TextField
            disabled={ !moduleEvent }
            size="small"
            fullWidth
            value={ localTitle }
            onChange={ (e) => setLocalTitle(e.target.value) }
            onBlur={ () => handleCommit({ title: localTitle }) }
        />
    );
}

export function ModuleEventView({ moduleId, eventId }: { moduleId: ModuleId; eventId: ModuleEventId; })
{
    const moduleEvent = useEvent(eventId);
    const { deleteEvent, updateEvent } = useModuleEventActions();

    const handleCommit = useCallback((updates: Partial<ModuleEvent>) =>
    {
        updateEvent(eventId, updates);
    }, [ eventId, updateEvent ]);

    const handleDeleteClick = useCallback(() =>
    {
        deleteEvent(moduleId, eventId);
    }, [ eventId, moduleId, deleteEvent ]);

    return (
        <TableRow>
            <TableCell>
                <ModuleEventTitle key={ `${moduleEvent?.title ?? '-title'}` } moduleEvent={ moduleEvent } handleCommit={ handleCommit } />
            </TableCell>
            <TableCell>
                <FormControl size="small" fullWidth disabled={ !moduleEvent }>
                    <Select
                        value={ moduleEvent?.type ?? ModuleEventType.Other }
                        onChange={ (e) => handleCommit({ type: e.target.value as ModuleEventType }) }
                    >
                        { (Object.values(ModuleEventType) as Array<ModuleEventType>).map((eventType) => (
                            <MenuItem key={ eventType } value={ eventType }>
                                { eventType }
                            </MenuItem>
                        )) }
                    </Select>
                </FormControl>
            </TableCell>
            <TableCell>
                <FormControl size="small" fullWidth disabled={ !moduleEvent } sx={ { m: 0, p: 0 } }>
                    <NumberSpinner
                        size="small"
                        step={ 5 }
                        largeStep={ 45 }
                        value={ moduleEvent?.minimumDuration ?? 0 }
                        onValueChange={ (v) => v ? handleCommit({ minimumDuration: v }) : {} }
                    />
                </FormControl>
            </TableCell>
            <TableCell>
                <IconButton size="small" onClick={ handleDeleteClick }>
                    <DeleteIcon fontSize="small" color="error" />
                </IconButton>
            </TableCell>
        </TableRow>
    );
}
