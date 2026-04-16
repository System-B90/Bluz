import AddIcon from '@mui/icons-material/Add';
import { CircularProgress, IconButton, Tooltip } from '@mui/material';
import { useSnackbar } from 'notistack';
import { useCallback, useState } from 'react';

import { enqueueApiErrorSnackbar } from "@/api-client/common";
import { ModuleEventType, SyllabusId } from "@/api-shared/types/gant/curriculum";
import { useModuleActions } from "@/components/gant/state/hooks/gant-funcs/UseModuleActions";
import { useModuleEventActions } from "@/components/gant/state/hooks/gant-funcs/UseModuleEventActions";

export function CreateModuleButton({ syllabusId }: { syllabusId: SyllabusId; })
{
    const { enqueueSnackbar } = useSnackbar();
    const { createEvent } = useModuleEventActions();
    const { createModule } = useModuleActions();
    const [ isCreating, setIsCreating ] = useState(false);

    const clickHandler = useCallback(async () =>
    {
        setIsCreating(true);
        try
        {
            const newModule = await createModule('מערך חדש', syllabusId, 'המערך החדש שלי');
            try
            {
                await createEvent('הרצאת מבוא', newModule.id, ModuleEventType.Lecture, 60);
                await createEvent('ע"ע', newModule.id, ModuleEventType.Exercise, 45);
            } catch (error)
            {
                enqueueApiErrorSnackbar(enqueueSnackbar, 'יצירת מופעי ברירת מחדל במערך נכשלה!', error);
            }
        }
        catch (error)
        {
            enqueueApiErrorSnackbar(enqueueSnackbar, 'יצירת המערך נכשלה!', error);
        } finally
        {
            setIsCreating(false);
        }
    }, [ syllabusId, enqueueSnackbar, createModule, createEvent ]);

    return (
        <Tooltip placement="top" title="מערך חדש">
            <span>
                <IconButton color="secondary" disabled={ isCreating } onClick={ clickHandler } size="small">
                    { isCreating ? <CircularProgress color="inherit" size="1.25rem" /> : <AddIcon fontSize="small" /> }
                </IconButton>
            </span>
        </Tooltip>
    );
}
