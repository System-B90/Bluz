"use client";
import Button from "@mui/material/Button";
import Dialog, { DialogProps } from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import
    {
        Dispatch,
        SetStateAction,
        useCallback,
        useMemo,
        useState,
        useTransition,
    } from "react";

import
    {
        GanttCurriculumId,
        GanttEventId,
        GanttModuleId,
        GanttSyllabusId
    } from "@/api-shared/types/gantt/models";
import { EventDialogContent } from "@/components/gantt/event-dialog/DialogContent";
import { EventDialogHeader } from "@/components/gantt/event-dialog/DialogHeader";
import { GanttConstraintProvider } from "@/components/gantt/state/constraints/Provider";
import { useModuleEventActions } from "@/components/gantt/state/hooks/gantt-funcs/UseModuleEventActions";
import { useEvent } from "@/components/gantt/state/hooks/UseEvent";
import { useCurriculumProviderActions, useCurriculumState } from "@/components/gantt/state/provider";


export type EventDialogProps = {
    setOpen: Dispatch<SetStateAction<boolean>>;
    eventId: GanttEventId | null;
    moduleId: GanttModuleId | null;
    syllabusId: GanttSyllabusId | null;
    curriculumId: GanttCurriculumId | null;
} & DialogProps;


function EventDialogInner({
    open,
    setOpen,
    eventId,
    moduleId,
    syllabusId,
    ...props
}: Omit<EventDialogProps, "curriculumId">)
{
    const { deleteEvent } = useModuleEventActions();
    const { openModuleDialog } = useCurriculumProviderActions();

    const [ isContentReady, setIsContentReady ] = useState(false);
    const event = useEvent(eventId ?? "");
    const state = useCurriculumState();
    const ganttModule = moduleId ? state.modules[ moduleId ] : null;
    const syllabus = syllabusId ? state.syllabuses[ syllabusId ] : null;

    const [ , startTransition ] = useTransition();
    const [ isActionLoading, setIsActionLoading ] = useState(false);

    const handleClose = useCallback(() => setOpen(false), [ setOpen ]);

    const handleModuleClick = useCallback(() =>
    {
        if (!syllabusId || !moduleId) return;
        setOpen(false);
        openModuleDialog(syllabusId, moduleId);
    }, [ syllabusId, moduleId, setOpen, openModuleDialog ]);

    const handleDelete = useCallback(() =>
    {
        if (!moduleId || !eventId) return;
        setIsActionLoading(true);
        deleteEvent(moduleId, eventId)
            .then(() =>
            {
                setIsActionLoading(false);
                setOpen(false);
            })
            .catch(() => setIsActionLoading(false));
    }, [ moduleId, eventId, deleteEvent, setOpen ]);

    if (eventId === null || moduleId === null) return null;

    return (
        <Dialog
            fullWidth
            maxWidth="lg"
            onClose={ handleClose }
            open={ open }
            { ...props }
            transitionDuration={ { enter: 200, exit: 100 } }
            slotProps={ {
                transition: {
                    onEnter: () => startTransition(() => setIsContentReady(true)),
                    onExited: () => setIsContentReady(false),
                }
            } }
        >
            <EventDialogHeader
                eventTitle={ event?.title }
                moduleTitle={ ganttModule?.title }
                onModuleClick={ ganttModule ? handleModuleClick : undefined }
                syllabusTitle={ syllabus?.title }
            />

            <EventDialogContent isContentReady={ isContentReady } event={ event } eventId={ eventId } moduleId={ moduleId } syllabus={ syllabus } />

            <DialogActions>
                <Button color="error" disabled={ isActionLoading } onClick={ handleDelete }>
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

export function EventDialog({
    curriculumId,
    syllabusId,
    moduleId,
    eventId,
    ...props
}: EventDialogProps)
{
    // Stable identity: GanttConstraintProvider refetches whenever this
    // object's reference changes, so it must not be recreated on every
    // render (e.g. while typing in unrelated fields).
    const constraintContext = useMemo(
        () =>
            curriculumId && syllabusId && moduleId && eventId
                ? ({
                    type: "event" as const,
                    curriculumId,
                    syllabusId,
                    moduleId,
                    eventId,
                })
                : null,
        [ curriculumId, syllabusId, moduleId, eventId ],
    );

    if (!constraintContext)
    {
        return (
            <EventDialogInner
                eventId={ eventId }
                moduleId={ moduleId }
                syllabusId={ syllabusId }
                { ...props }
            />
        );
    }

    return (
        <GanttConstraintProvider context={ constraintContext }>
            <EventDialogInner
                eventId={ eventId }
                moduleId={ moduleId }
                syllabusId={ syllabusId }
                { ...props }
            />
        </GanttConstraintProvider>
    );
}
