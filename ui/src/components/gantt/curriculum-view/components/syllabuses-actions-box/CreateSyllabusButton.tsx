import AddIcon from "@mui/icons-material/Add";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import TextField from "@mui/material/TextField";
import { useSnackbar } from "notistack";
import { FormEvent, useCallback, useState } from "react";

import { GanttCurriculumId } from "@/api-shared/types/gantt/models";
import { COMMAND_GROUPS } from "@/components/app-commands/labels";
import { useCommand } from "@/components/app-commands/use-command";
import { enqueueApiErrorSnackbar } from "@/components/base/ApiErrorSnackbar";
import { useCurriculumProviderActions } from "@/components/gantt/state/context";
import { useSyllabusActions } from "@/components/gantt/state/hooks/gantt-funcs/UseSyllabusActions";

export const NEW_SYLLABUS_NAME_LABEL = "שם הסילבוס החדש";
export const CREATE_SYLLABUS_CONFIRM = "יצירה";

/**
 * "סילבוס חדש" asks for a name first and creates nothing until one is
 * confirmed (#845). It used to save a placeholder "סילבוס חדש" record on every
 * click, so double clicks and exploration left junk syllabuses behind.
 */
export function CreateSyllabusButton({
    curriculumId,
}: {
    curriculumId: GanttCurriculumId;
}) {
    const { enqueueSnackbar } = useSnackbar();
    const { createSyllabus } = useSyllabusActions();
    const { openSyllabusDialog } = useCurriculumProviderActions();
    const [ open, setOpen ] = useState(false);
    const [ name, setName ] = useState("");
    const [ creating, setCreating ] = useState(false);

    const openPrompt = useCallback(() => {
        setName("");
        setOpen(true);
    }, []);

    const close = useCallback(() => {
        if (!creating) setOpen(false);
    }, [ creating ]);

    const trimmed = name.trim();

    const submit = useCallback((event?: FormEvent) => {
        event?.preventDefault();
        if (!trimmed || creating) return;
        setCreating(true);
        createSyllabus(trimmed, curriculumId)
            .then((syllabus) => {
                setOpen(false);
                if (!syllabus) return;
                // The new card lands among many others with no visible cue,
                // so confirm it and open it for editing (#758).
                enqueueSnackbar("נוצר סילבוס חדש", { variant: "success" });
                openSyllabusDialog(syllabus.id);
            })
            .catch((error) =>
                enqueueApiErrorSnackbar(
                    enqueueSnackbar,
                    "יצירת הסילבוס נכשלה!",
                    error,
                ),
            )
            .finally(() => setCreating(false));
    }, [ trimmed, creating, curriculumId, createSyllabus, enqueueSnackbar, openSyllabusDialog ]);

    useCommand({
        id: "gantt.syllabus.new",
        title: "סילבוס חדש",
        group: COMMAND_GROUPS.gantt,
        icon: <AddIcon />,
        keywords: [ "new syllabus", "create syllabus", "add", "סילבוס" ],
        run: openPrompt,
    });

    return (
        <>
            <Button
                onClick={ openPrompt }
                size="small"
                startIcon={ <AddIcon /> }
                variant="contained"
            >
                סילבוס חדש
            </Button>
            <Dialog fullWidth maxWidth="xs" onClose={ close } open={ open }>
                <form onSubmit={ submit }>
                    <DialogTitle>סילבוס חדש</DialogTitle>
                    <DialogContent>
                        <TextField
                            autoFocus
                            fullWidth
                            label={ NEW_SYLLABUS_NAME_LABEL }
                            margin="dense"
                            onChange={ (e) => setName(e.target.value) }
                            required
                            size="small"
                            value={ name }
                        />
                    </DialogContent>
                    <DialogActions>
                        <Button disabled={ creating } onClick={ close }>ביטול</Button>
                        <Button disabled={ !trimmed || creating } type="submit" variant="contained">
                            { CREATE_SYLLABUS_CONFIRM }
                        </Button>
                    </DialogActions>
                </form>
            </Dialog>
        </>
    );
}
