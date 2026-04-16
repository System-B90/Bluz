import AddIcon from '@mui/icons-material/Add';
import
{
    Box,
    IconButton,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    Typography
} from "@mui/material";
import { useCallback, useMemo } from "react";

import { ModuleEventId, ModuleId } from "@/api-shared/types/gant/curriculum";
import { ModuleEventView } from "@/components/gant/module-dialog/ModuleEventView";
import { useModuleEventActions } from "@/components/gant/state/hooks/gant-funcs/UseModuleEventActions";

function CreateModuleEventButton({ moduleId }: { moduleId: ModuleId; })
{
    const { createEvent } = useModuleEventActions();
    const clickHandler = useCallback(() =>
    {
        createEvent('מופע חדש', moduleId);
    }, [ moduleId, createEvent ]);

    return (
        <IconButton size="small" onClick={ clickHandler }>
            <AddIcon fontSize="small" color='info' />
        </IconButton>
    );
}

export function ModuleEventsView({ moduleId, eventIds }: { moduleId: ModuleId; eventIds: Array<ModuleEventId>; })
{
    const eventItems = useMemo(() => eventIds.map(
        (eventId) => (<ModuleEventView key={ eventId } moduleId={ moduleId } eventId={ eventId } />)
    ), [ moduleId, eventIds ]);

    return (
        <Box display={ 'flex' } flexWrap={ 'wrap' } alignItems={ 'flex-end' } gap={ 2 } flexGrow={ 1 } maxHeight={ '100%' }>
            <Table size="small" stickyHeader={ true } sx={ { flexGrow: 1 } }>
                <TableHead>
                    <TableRow>
                        <TableCell><Typography variant="h6">שם</Typography></TableCell>
                        <TableCell><Typography variant="h6">סוג</Typography></TableCell>
                        <TableCell><Typography variant="h6">זמן מינימלי (דק&apos;)</Typography></TableCell>
                        <TableCell>
                            <CreateModuleEventButton moduleId={ moduleId } />
                        </TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    { eventItems }
                </TableBody>
            </Table>
        </Box>
    );
}
