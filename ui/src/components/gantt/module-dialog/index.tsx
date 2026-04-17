import
    {
        Box,
        Button,
        Dialog,
        DialogActions,
        DialogContent,
        DialogProps,
        DialogTitle,
        Divider,
        Stack,
        TextField
    } from "@mui/material";
import { useSnackbar } from "notistack";
import { Dispatch, SetStateAction, useCallback, useState } from "react";

import { enqueueApiErrorSnackbar } from "@/api-client/common";
import { GanttModule, GanttModuleId, GanttSyllabusId } from "@/api-shared/types/gantt/curriculum";
import { ModuleEventsView } from "@/components/gantt/module-dialog/ModuleEventsView";
import { HiveModulesView } from "@/components/gantt/module-dialog/utils";
import { useModuleActions } from "@/components/gantt/state/hooks/gantt-funcs/UseModuleActions";
import { useModule } from "@/components/gantt/state/hooks/UseModule";
import { useCurriculumProviderActions } from "@/components/gantt/state/provider";

export interface ModuleDialogProps extends DialogProps
{
    setOpen: Dispatch<SetStateAction<boolean>>;
    moduleId: GanttModuleId | null;
    syllabusId: null | GanttSyllabusId;
}

export function ModuleDialog({
    open,
    setOpen,
    syllabusId,
    moduleId,
    ...props
}: ModuleDialogProps)
{
    const { enqueueSnackbar } = useSnackbar();
    const { closeModuleDialog } = useCurriculumProviderActions();
    const { deleteModule, updateModule } = useModuleActions();
    const moduleDoc = useModule(moduleId ?? '');

    const [ isActionLoading, setIsActionLoading ] = useState<boolean>(false);

    // Local State Buffers
    const [ localTitle, setLocalTitle ] = useState(moduleDoc?.title ?? "");
    const [ localDescription, setLocalDescription ] = useState(moduleDoc?.description ?? "");

    const handleClose = useCallback(() =>
    {
        setOpen(false);
    }, [ setOpen ]);

    const handleCommit = useCallback((updates: Partial<GanttModule>) =>
    {
        if (!syllabusId || !moduleId) return;
        updateModule(moduleId, updates)
            .catch((error) => enqueueApiErrorSnackbar(enqueueSnackbar, 'שמירת המערך נכשלה!', error));
    }, [ moduleId, syllabusId, updateModule, enqueueSnackbar ]);

    const handleDelete = useCallback(() =>
    {
        if (!syllabusId || !moduleId) return;

        setIsActionLoading(true);
        deleteModule(syllabusId, moduleId)
            .then(() =>
            {
                closeModuleDialog();
                setIsActionLoading(false);
                setOpen(false);
            })
            .catch(() => setIsActionLoading(false));
    }, [ syllabusId, moduleId, deleteModule, closeModuleDialog, setOpen ]);

    // Ensure hooks are called before this check
    if (syllabusId === null || moduleId === null) return null;

    return (
        <Dialog fullWidth maxWidth="xl" onClose={ handleClose } open={ open } { ...props }>
            <DialogTitle>עריכת מערך</DialogTitle>

            <DialogContent>
                <Box alignItems="flex-start" display="flex" flexDirection="row" gap={ 2 } mt={ 1 }>
                    <Stack spacing={ 2 } width="30%">
                        <TextField
                            fullWidth
                            label="כותרת"
                            onBlur={ () => handleCommit({ title: localTitle }) }
                            onChange={ (e) => setLocalTitle(e.target.value) }
                            value={ localTitle }
                        />

                        <TextField
                            fullWidth
                            label="תיאור"
                            minRows={ 10 } // Increased rows since it's a dialog editor
                            multiline
                            onBlur={ () => handleCommit({ description: localDescription }) }
                            onChange={ (e) => setLocalDescription(e.target.value) }
                            sx={ {
                                flex: 1,
                                '& .MuiInputBase-root': { height: '100%', alignItems: 'stretch' },
                                '& textarea': { height: '100% !important' },
                            } }
                            value={ localDescription }
                        />
                    </Stack>

                    <Divider flexItem orientation="vertical" />

                    <Stack flexGrow={ 1 } mt={ 1 } spacing={ 2 }>
                        <ModuleEventsView eventIds={ moduleDoc?.events ?? [] } moduleId={ moduleId } />
                        <HiveModulesView hiveModules={ moduleDoc?.hiveIds ?? [] } />
                    </Stack>
                </Box>
            </DialogContent>

            <DialogActions>
                <Button
                    color="error"
                    disabled={ isActionLoading }
                    onClick={ handleDelete }
                >
                    מחיקה
                </Button>

                <Button
                    color="primary"
                    disabled={ isActionLoading }
                    onClick={ handleClose }
                    variant="contained"
                >
                    סגירה
                </Button>
            </DialogActions>
        </Dialog>
    );
}
