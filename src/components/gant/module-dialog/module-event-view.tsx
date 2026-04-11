import { ModuleEvent, ModuleEventId, ModuleEventType, ModuleId } from "@/api-shared/types/gant/curriculum";
import NumberSpinner from "@/components/base/number-spinner";
import { useEvent, useGantFuncs } from "@/components/gant/state/hooks";
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
import { useCallback, useEffect, useState } from "react";

export function ModuleEventView({ moduleId, eventId }: { moduleId: ModuleId; eventId: ModuleEventId; })
{
    const moduleEvent = useEvent(eventId);
    const { removeEvent, updateEvent } = useGantFuncs();

    // Local state to buffer inputs before committing to global store
    const [ localTitle, setLocalTitle ] = useState(moduleEvent?.title ?? '');
    const [ localDuration, setLocalDuration ] = useState(moduleEvent?.minimumDuration ?? 0);

    useEffect(() =>
    {
        if (moduleEvent)
        {
            setLocalTitle(moduleEvent.title);
            setLocalDuration(moduleEvent.minimumDuration);
        }
    }, [ moduleEvent?.title, moduleEvent?.minimumDuration ]);

    const handleCommit = useCallback((updates: Partial<ModuleEvent>) =>
    {
        // Only trigger update if something actually changed
        updateEvent(eventId, updates);
    }, [ eventId, updateEvent ]);

    const handleDeleteClick = useCallback(() =>
    {
        removeEvent(moduleId, eventId);
    }, [ eventId, moduleId, removeEvent ]);

    return (
        <TableRow>
            <TableCell>
                <TextField
                    disabled={ !moduleEvent }
                    size="small"
                    fullWidth
                    value={ localTitle }
                    onChange={ (e) => setLocalTitle(e.target.value) }
                    onBlur={ () => handleCommit({ title: localTitle }) }
                />
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
