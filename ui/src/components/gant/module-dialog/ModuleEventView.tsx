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
            fullWidth
            onBlur={ () => handleCommit({ title: localTitle }) }
            onChange={ (e) => setLocalTitle(e.target.value) }
            size="small"
            value={ localTitle }
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
                <ModuleEventTitle handleCommit={ handleCommit } key={ `${moduleEvent?.title ?? '-title'}` } moduleEvent={ moduleEvent } />
            </TableCell>
            <TableCell>
                <FormControl disabled={ !moduleEvent } fullWidth size="small">
                    <Select
                        onChange={ (e) => handleCommit({ type: e.target.value as ModuleEventType }) }
                        value={ moduleEvent?.type ?? ModuleEventType.Other }
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
                <FormControl disabled={ !moduleEvent } fullWidth size="small" sx={ { m: 0, p: 0 } }>
                    <NumberSpinner
                        largeStep={ 45 }
                        onValueChange={ (v) => v ? handleCommit({ minimumDuration: v }) : {} }
                        size="small"
                        step={ 5 }
                        value={ moduleEvent?.minimumDuration ?? 0 }
                    />
                </FormControl>
            </TableCell>
            <TableCell>
                <IconButton onClick={ handleDeleteClick } size="small">
                    <DeleteIcon color="error" fontSize="small" />
                </IconButton>
            </TableCell>
        </TableRow>
    );
}
