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
import { useConfirmDialog } from "@/components/base/UseConfirmDialog";
import { EventDialogContent } from "@/components/gantt/event-dialog/DialogContent";
import { EventDialogHeader } from "@/components/gantt/event-dialog/DialogHeader";
import { MoveEventDialog } from "@/components/gantt/module-dialog/MoveEventDialog";
import { GanttConstraintProvider } from "@/components/gantt/state/constraints/Provider";
import { useCurriculumProviderActions, useCurriculumState } from "@/components/gantt/state/context";
import { useModuleEventActions } from "@/components/gantt/state/hooks/gantt-funcs/UseModuleEventActions";
import { useEvent } from "@/components/gantt/state/hooks/UseEvent";

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
    const [ moveDialogOpen, setMoveDialogOpen ] = useState(false);
    const event = useEvent(eventId ?? "");
    const state = useCurriculumState();
    const ganttModule = moduleId ? state.modules[ moduleId ] : null;
    const syllabus = syllabusId ? state.syllabuses[ syllabusId ] : null;

    const [ , startTransition ] = useTransition();
    const [ isActionLoading, setIsActionLoading ] = useState(false);
    const { confirm, confirmDialog } = useConfirmDialog();

    const handleClose = useCallback(() => setOpen(false), [ setOpen ]);

    const handleModuleClick = useCallback(() =>
    {
        if (!syllabusId || !moduleId) return;
        setOpen(false);
        openModuleDialog(syllabusId, moduleId);
    }, [ syllabusId, moduleId, setOpen, openModuleDialog ]);

    // A gantt delete has no undo, so one stray click on מחיקה used to
    // drop the event — and its placement, constraints and shuffles — for
    // good. Ask first.
    const handleDelete = useCallback(async () =>
    {
        if (!moduleId || !eventId) return;
        const ok = await confirm(
            `למחוק את המופע "${event?.title ?? ""}"? לא ניתן לבטל.`,
            { title: "מחיקת מופע", confirmLabel: "למחוק" },
        );
        if (!ok) return;
        setIsActionLoading(true);
        deleteEvent(moduleId, eventId)
            .then(() =>
            {
                setIsActionLoading(false);
                setOpen(false);
            })
            .catch(() => setIsActionLoading(false));
    }, [ moduleId, eventId, event?.title, confirm, deleteEvent, setOpen ]);

    if (eventId === null || moduleId === null) return null;

    return (
        <Dialog
            fullWidth
            maxWidth="md"
            onClose={ handleClose }
            open={ open }
            { ...props }
            slotProps={ {
                transition: {
                    onEnter: () => startTransition(() => setIsContentReady(true)),
                    onExited: () => setIsContentReady(false),
                }
            } }
            transitionDuration={ { enter: 200, exit: 100 } }
        >
            <EventDialogHeader
                eventTitle={ event?.title }
                moduleTitle={ ganttModule?.title }
                onModuleClick={ ganttModule ? handleModuleClick : undefined }
                syllabusTitle={ syllabus?.title }
            />

            <EventDialogContent curriculumId={ syllabus?.curriculumId ?? null } event={ event } eventId={ eventId } isContentReady={ isContentReady } moduleId={ moduleId } syllabus={ syllabus } />

            <DialogActions>
                <Button
                    color="error"
                    disabled={ isActionLoading }
                    onClick={ () => void handleDelete() }
                >
                    מחיקה
                </Button>
                <Button
                    disabled={ isActionLoading }
                    onClick={ () => setMoveDialogOpen(true) }
                    sx={ { marginInlineEnd: "auto" } }
                >
                    העבר למערך אחר
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
            <MoveEventDialog
                currentModuleId={ moduleId }
                eventId={ eventId }
                onClose={ () => setMoveDialogOpen(false) }
                open={ moveDialogOpen }
            />
            { confirmDialog }
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
