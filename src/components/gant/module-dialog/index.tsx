import { Module, ModuleId, SyllabusId } from "@/api-shared/types/gant/curriculum";
import { ModuleEventsView } from "@/components/gant/module-dialog/module-events-view";
import { HiveModulesView } from "@/components/gant/module-dialog/utils";
import { useGantFuncs, useModule } from "@/components/gant/state/hooks";
import { useCurriculumProviderActions } from "@/components/gant/state/provider";
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
import { Dispatch, SetStateAction, useCallback, useEffect, useState } from "react";

export interface ModuleDialogProps extends DialogProps
{
    setOpen: Dispatch<SetStateAction<boolean>>;
    onSave?: (updated: Module) => void;
    moduleId: ModuleId | null;
    syllabusId: SyllabusId | null;
}

export default function ModuleDialog({
    open,
    setOpen,
    onSave,
    syllabusId,
    moduleId,
    ...props
}: ModuleDialogProps)
{
    const { closeModuleDialog } = useCurriculumProviderActions();
    const { removeModule, updateModule } = useGantFuncs();
    const module = useModule(moduleId ?? '');

    const [ isActionLoading, setIsActionLoading ] = useState<boolean>(false);

    // Local State Buffers
    const [ localTitle, setLocalTitle ] = useState(module?.title ?? "");
    const [ localDescription, setLocalDescription ] = useState(module?.description ?? "");

    // Sync local state when the global module data changes (initial load or external updates)
    useEffect(() =>
    {
        if (module)
        {
            setLocalTitle(module.title);
            setLocalDescription(module.description);
        }
    }, [ module?.title, module?.description ]);

    const handleClose = useCallback(() =>
    {
        setOpen(false);
    }, [ setOpen ]);

    const handleCommit = useCallback((updates: Partial<Module>) =>
    {
        if (!syllabusId || !moduleId) return;
        updateModule(moduleId, updates);
    }, [ moduleId, syllabusId, updateModule ]);

    const handleDelete = useCallback(() =>
    {
        if (!syllabusId || !moduleId) return;

        setIsActionLoading(true);
        removeModule(syllabusId, moduleId)
            .then(() =>
            {
                closeModuleDialog();
                setIsActionLoading(false);
                setOpen(false);
            })
            .catch(() => setIsActionLoading(false));
    }, [ syllabusId, moduleId, removeModule, closeModuleDialog, setOpen ]);

    // Ensure hooks are called before this check
    if (syllabusId === null || moduleId === null) return null;

    return (
        <Dialog open={ open } onClose={ handleClose } fullWidth maxWidth="xl" { ...props }>
            <DialogTitle>עריכת מערך</DialogTitle>

            <DialogContent>
                <Box mt={ 1 } display="flex" flexDirection="row" gap={ 2 } alignItems="flex-start">
                    <Stack spacing={ 2 } width="30%">
                        <TextField
                            label="כותרת"
                            fullWidth
                            value={ localTitle }
                            onChange={ (e) => setLocalTitle(e.target.value) }
                            onBlur={ () => handleCommit({ title: localTitle }) }
                        />

                        <TextField
                            sx={ {
                                flex: 1,
                                '& .MuiInputBase-root': { height: '100%', alignItems: 'stretch' },
                                '& textarea': { height: '100% !important' },
                            } }
                            label="תיאור"
                            fullWidth
                            multiline
                            minRows={ 10 } // Increased rows since it's a dialog editor
                            value={ localDescription }
                            onChange={ (e) => setLocalDescription(e.target.value) }
                            onBlur={ () => handleCommit({ description: localDescription }) }
                        />
                    </Stack>

                    <Divider orientation="vertical" flexItem />

                    <Stack spacing={ 2 } mt={ 1 } flexGrow={ 1 }>
                        <ModuleEventsView moduleId={ moduleId } eventIds={ module?.events ?? [] } />
                        <HiveModulesView hiveModules={ module?.hiveIds ?? [] } />
                    </Stack>
                </Box>
            </DialogContent>

            <DialogActions>
                <Button
                    onClick={ handleDelete }
                    disabled={ isActionLoading }
                    color="error"
                >
                    מחיקה
                </Button>

                <Button
                    onClick={ handleClose }
                    disabled={ isActionLoading }
                    color="primary"
                    variant="contained"
                >
                    סגירה
                </Button>
            </DialogActions>
        </Dialog>
    );
}