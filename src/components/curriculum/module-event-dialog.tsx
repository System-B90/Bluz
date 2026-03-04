import { ModuleEvent } from "@/api-shared/types/curriculum";
import { useModuleEvent } from "@/components/curriculum/module-event-provider";
import
{
    Dialog,
    DialogActions,
    DialogContent,
    DialogProps,
    DialogTitle,
    Button
} from "@mui/material";
import { Dispatch, SetStateAction, useCallback } from "react";

interface ModuleEventDialogProps extends DialogProps
{
    setOpen: Dispatch<SetStateAction<boolean>>;
    onSave?: (updated: ModuleEvent) => void;
}

export default function ModuleEventDialog({
    open,
    setOpen,
    onSave,
    ...props
}: ModuleEventDialogProps)
{
    const { data: moduleEvent, setData: setModuleEvent, save } = useModuleEvent();

    const handleClose = useCallback(() =>
    {
        setOpen(false);
    }, []);

    const handleSave = useCallback(() =>
    {
        if (moduleEvent)
        {
            save().then((savedModuleEvent) =>
            {
                if (savedModuleEvent)
                {
                    onSave?.(savedModuleEvent);
                }
            });
        }
        setOpen(false);
    }, [ moduleEvent, save, onSave ]);

    return (
        <Dialog open={ open } onClose={ handleClose } fullWidth maxWidth="xl" { ...props }>
            <DialogTitle>עריכת מופע</DialogTitle>

            <DialogContent>

            </DialogContent>

            <DialogActions>
                <Button onClick={ handleClose }>
                    ביטול
                </Button>

                <Button
                    variant="contained"
                    onClick={ handleSave }
                    disabled={ !moduleEvent?.title?.trim() }
                >
                    שמור
                </Button>
            </DialogActions>
        </Dialog>
    );
}
