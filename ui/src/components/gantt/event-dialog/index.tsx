"use client";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog, { DialogProps } from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Divider from "@mui/material/Divider";
import FormControl from "@mui/material/FormControl";
import FormControlLabel from "@mui/material/FormControlLabel";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useSnackbar } from "notistack";
import {
    Dispatch,
    SetStateAction,
    useCallback,
    useMemo,
    useState,
    useTransition,
} from "react";

import { enqueueApiErrorSnackbar } from "@/api-client/common";
import {
    EventRecurrence,
    GanttCurriculumId,
    GanttEvent,
    GanttEventId,
    GanttModuleId,
    GanttSyllabusId,
    ModuleEventType,
    RoomRequirement,
} from "@/api-shared/types/gantt/models";
import { InstructorSelect } from "@/components/base/InstructorSelect";
import { NumberSpinner } from "@/components/base/NumberSpinner";
import { EventConstraintsView } from "@/components/gantt/event-dialog/constraints/EventConstraintsView";
import { RecommendedLecturersField } from "@/components/gantt/event-dialog/RecommendedLecturersField";
import { SystemRequirementsField } from "@/components/gantt/event-dialog/SystemRequirementsField";
import { GanttConstraintProvider } from "@/components/gantt/state/constraints/Provider";
import { useModuleEventActions } from "@/components/gantt/state/hooks/gantt-funcs/UseModuleEventActions";
import { useEvent } from "@/components/gantt/state/hooks/UseEvent";
import { useCurriculumProviderActions, useCurriculumState } from "@/components/gantt/state/provider";

const RECURRENCE_LABELS: Record<EventRecurrence, string> = {
    [EventRecurrence.None]: "ללא",
    [EventRecurrence.Daily]: "יומי",
    [EventRecurrence.Weekly]: "שבועי",
};

export type EventDialogProps = {
    setOpen: Dispatch<SetStateAction<boolean>>;
    eventId: GanttEventId | null;
    moduleId: GanttModuleId | null;
    syllabusId: GanttSyllabusId | null;
    curriculumId: GanttCurriculumId | null;
} & DialogProps;

function EventDialogHeader({
    eventTitle,
    moduleTitle,
    syllabusTitle,
    onModuleClick,
}: {
    eventTitle?: string;
    moduleTitle?: string;
    syllabusTitle?: string;
    onModuleClick?: () => void;
}) {
    return (
        <DialogTitle sx={{ pb: 1 }}>
            <Stack spacing={0.5}>
                <Typography component="span" sx={{ fontWeight: "bold" }} variant="h5">
                    עריכת מופע: {eventTitle}
                </Typography>
                {(!!syllabusTitle || !!moduleTitle) && (
                    <Typography
                        component="span"
                        sx={{ color: "text.secondary" }}
                        variant="caption"
                    >
                        {syllabusTitle}
                        {!!syllabusTitle && !!moduleTitle && " / "}
                        {!!moduleTitle && (
                            <Typography
                                component="span"
                                onClick={onModuleClick}
                                sx={{
                                    color: "text.secondary",
                                    cursor: onModuleClick ? "pointer" : undefined,
                                    "&:hover": onModuleClick
                                        ? { textDecoration: "underline" }
                                        : undefined,
                                }}
                                variant="caption"
                            >
                                {moduleTitle}
                            </Typography>
                        )}
                    </Typography>
                )}
            </Stack>
        </DialogTitle>
    );
}

function EventDetailsForm({
    event,
    localTitle,
    localComment,
    setLocalTitle,
    setLocalComment,
    commit,
}: {
    event: GanttEvent;
    localTitle: string;
    localComment: string;
    setLocalTitle: (v: string) => void;
    setLocalComment: (v: string) => void;
    commit: (updates: Partial<GanttEvent>) => void;
}) {
    return (
        <Stack spacing={2} width="32%">
            <TextField
                fullWidth
                label="שם"
                onBlur={() => {
                    if (localTitle !== event.title) commit({ title: localTitle });
                }}
                onChange={(e) => setLocalTitle(e.target.value)}
                value={localTitle}
            />

            <FormControl fullWidth>
                <InputLabel>סוג</InputLabel>
                <Select
                    label="סוג"
                    onChange={(e) =>
                        commit({ type: e.target.value as ModuleEventType })
                    }
                    value={event.type}
                >
                    {Object.values(ModuleEventType).map((t) => (
                        <MenuItem key={t} value={t}>
                            {t}
                        </MenuItem>
                    ))}
                </Select>
            </FormControl>

            <Box>
                <Typography color="text.secondary" variant="caption">
                    זמן מינימלי (דק&apos;)
                </Typography>
                <NumberSpinner
                    largeStep={45}
                    onValueChange={(v) =>
                        v ? commit({ minimumDuration: v }) : undefined
                    }
                    step={5}
                    value={event.minimumDuration}
                />
            </Box>

            <FormControl fullWidth>
                <InputLabel>דרישת חדר</InputLabel>
                <Select
                    label="דרישת חדר"
                    onChange={(e) =>
                        commit({
                            roomRequirement: e.target.value as RoomRequirement,
                        })
                    }
                    value={event.roomRequirement}
                >
                    {Object.values(RoomRequirement).map((r) => (
                        <MenuItem key={r} value={r}>
                            {r}
                        </MenuItem>
                    ))}
                </Select>
            </FormControl>

            <FormControl fullWidth>
                <InputLabel>חזרה</InputLabel>
                <Select
                    label="חזרה"
                    onChange={(e) =>
                        commit({ recurrence: e.target.value as EventRecurrence })
                    }
                    value={event.recurrence}
                >
                    {Object.values(EventRecurrence).map((r) => (
                        <MenuItem key={r} value={r}>
                            {RECURRENCE_LABELS[r]}
                        </MenuItem>
                    ))}
                </Select>
            </FormControl>
            {event.recurrence === EventRecurrence.Weekly && (
                <Typography color="text.secondary" variant="caption">
                    המופע יחזור בכל שבוע בגאנט.
                </Typography>
            )}
            {event.recurrence === EventRecurrence.Daily && (
                <Typography color="text.secondary" variant="caption">
                    המופע יחזור מדי יום.
                </Typography>
            )}

            <Box display="flex" gap={2}>
                <FormControlLabel
                    control={
                        <Switch
                            checked={event.isCritical}
                            onChange={(e) =>
                                commit({ isCritical: e.target.checked })
                            }
                        />
                    }
                    label="קריטי"
                />
                <FormControlLabel
                    control={
                        <Switch
                            checked={event.isPaWindow}
                            onChange={(e) =>
                                commit({ isPaWindow: e.target.checked })
                            }
                        />
                    }
                    label='חלון פ"א'
                />
            </Box>

            <TextField
                fullWidth
                label="הערה"
                minRows={3}
                multiline
                onBlur={() => {
                    const next = localComment.trim() === "" ? null : localComment;
                    if (next !== event.comment) commit({ comment: next });
                }}
                onChange={(e) => setLocalComment(e.target.value)}
                value={localComment}
            />
        </Stack>
    );
}

function EventDialogInner({
    open,
    setOpen,
    eventId,
    moduleId,
    syllabusId,
    ...props
}: Omit<EventDialogProps, "curriculumId">) {
    const { enqueueSnackbar } = useSnackbar();
    const { updateEvent, deleteEvent } = useModuleEventActions();
    const { openModuleDialog } = useCurriculumProviderActions();

    const event = useEvent(eventId ?? "");
    const state = useCurriculumState();
    const ganttModule = moduleId ? state.modules[moduleId] : null;
    const syllabus = syllabusId ? state.syllabuses[syllabusId] : null;

    const [isContentReady, setIsContentReady] = useState(false);
    const [, startTransition] = useTransition();
    const [isActionLoading, setIsActionLoading] = useState(false);

    const [localTitle, setLocalTitle] = useState(event?.title ?? "");
    const [localComment, setLocalComment] = useState(event?.comment ?? "");

    const commit = useCallback(
        (updates: Partial<GanttEvent>) => {
            if (!eventId) return;
            updateEvent(eventId, updates).catch((error) =>
                enqueueApiErrorSnackbar(enqueueSnackbar, "עדכון המופע נכשל!", error),
            );
        },
        [eventId, updateEvent, enqueueSnackbar],
    );

    const handleClose = useCallback(() => setOpen(false), [setOpen]);

    const handleModuleClick = useCallback(() => {
        if (!syllabusId || !moduleId) return;
        setOpen(false);
        openModuleDialog(syllabusId, moduleId);
    }, [syllabusId, moduleId, setOpen, openModuleDialog]);

    const handleDelete = useCallback(() => {
        if (!moduleId || !eventId) return;
        setIsActionLoading(true);
        deleteEvent(moduleId, eventId)
            .then(() => {
                setIsActionLoading(false);
                setOpen(false);
            })
            .catch(() => setIsActionLoading(false));
    }, [moduleId, eventId, deleteEvent, setOpen]);

    if (eventId === null || moduleId === null) return null;

    return (
        <Dialog
            fullWidth
            maxWidth="lg"
            onClose={handleClose}
            open={open}
            {...props}
            transitionDuration={{ enter: 200, exit: 100 }}
            TransitionProps={{
                onEnter: () => startTransition(() => setIsContentReady(true)),
                onExited: () => setIsContentReady(false),
            }}
        >
            <EventDialogHeader
                eventTitle={event?.title}
                moduleTitle={ganttModule?.title}
                onModuleClick={ganttModule ? handleModuleClick : undefined}
                syllabusTitle={syllabus?.title}
            />

            <DialogContent sx={{ pt: 1, mt: -1 }}>
                {isContentReady && event ? (
                    <>
                        <Box
                            alignItems="flex-start"
                            display="flex"
                            flexDirection="row"
                            gap={2}
                            mt={1}
                        >
                            <EventDetailsForm
                                commit={commit}
                                event={event}
                                localComment={localComment}
                                localTitle={localTitle}
                                setLocalComment={setLocalComment}
                                setLocalTitle={setLocalTitle}
                            />

                            <Divider flexItem orientation="vertical" />

                            <Stack flexGrow={1} spacing={3}>
                                <Stack spacing={1}>
                                    <Typography
                                        sx={{ fontWeight: "bold" }}
                                        variant="subtitle2"
                                    >
                                        אחראי
                                    </Typography>
                                    <FormControl fullWidth size="small">
                                        <InputLabel>אחראי</InputLabel>
                                        <InstructorSelect<"" | number>
                                            label="אחראי"
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                commit({
                                                    orchestratorId:
                                                        val === ""
                                                            ? null
                                                            : Number(val),
                                                });
                                            }}
                                            value={event.orchestratorId ?? ""}
                                        >
                                            <MenuItem value="">
                                                <em>ללא אחראי</em>
                                            </MenuItem>
                                        </InstructorSelect>
                                    </FormControl>
                                    {event.orchestratorId === null && (
                                        <Alert severity="warning">
                                            למופע זה לא הוגדר אחראי. מומלץ להגדיר
                                            אחראי מבין המדריכים.
                                        </Alert>
                                    )}
                                </Stack>

                                <RecommendedLecturersField
                                    onChange={(ids) =>
                                        commit({ recommendedLecturerIds: ids })
                                    }
                                    outsiderIds={event.recommendedLecturerIds}
                                />

                                <SystemRequirementsField
                                    onChange={(reqs) =>
                                        commit({ systemRequirements: reqs })
                                    }
                                    requirements={event.systemRequirements}
                                />
                            </Stack>
                        </Box>

                        <Box height="1rem" />
                        <EventConstraintsView
                            eventId={eventId}
                            moduleId={moduleId}
                        />
                    </>
                ) : (
                    <Box display="flex" flexDirection="row" gap={2} mt={1}>
                        <Stack spacing={2} width="32%">
                            <Skeleton height={56} variant="rounded" />
                            <Skeleton height={56} variant="rounded" />
                            <Skeleton height={56} variant="rounded" />
                            <Skeleton height={56} variant="rounded" />
                        </Stack>
                        <Divider flexItem orientation="vertical" />
                        <Stack flexGrow={1} spacing={1}>
                            <Skeleton height={56} variant="rounded" />
                            <Skeleton height={120} variant="rounded" />
                            <Skeleton height={120} variant="rounded" />
                        </Stack>
                    </Box>
                )}
            </DialogContent>

            <DialogActions>
                <Button color="error" disabled={isActionLoading} onClick={handleDelete}>
                    מחיקה
                </Button>
                <Button
                    color="primary"
                    disabled={isActionLoading}
                    onClick={handleClose}
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
}: EventDialogProps) {
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
        [curriculumId, syllabusId, moduleId, eventId],
    );

    if (!constraintContext) {
        return (
            <EventDialogInner
                eventId={eventId}
                moduleId={moduleId}
                syllabusId={syllabusId}
                {...props}
            />
        );
    }

    return (
        <GanttConstraintProvider context={constraintContext}>
            <EventDialogInner
                eventId={eventId}
                moduleId={moduleId}
                syllabusId={syllabusId}
                {...props}
            />
        </GanttConstraintProvider>
    );
}
